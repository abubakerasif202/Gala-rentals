import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import { buildFleetCarSeedRows, buildFleetDriverSeedRows } from './realtime-fleet-data.js';
import {
    createSupabaseAdminClient,
    getCoreSchemaMode,
    mapApplicationPayloadForSchema,
    mapCarPayloadForSchema,
    mapRentalPayloadForSchema,
} from './fleet-sync-utils.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const insertInChunks = async (table, rows, select) => {
    const inserted = [];

    for (let offset = 0; offset < rows.length; offset += 100) {
        const chunk = rows.slice(offset, offset + 100);
        if (chunk.length === 0) {
            continue;
        }

        const { data, error } = await supabase.from(table).insert(chunk).select(select);

        if (error) {
            throw error;
        }

        inserted.push(...(data || []));
    }

    return inserted;
};

async function seedData() {
    console.log("Seeding live fleet data...");

    try {
        const { supabaseUrl: adminSupabaseUrl, supabaseServiceRoleKey } = createSupabaseAdminClient();
        const coreMode = await getCoreSchemaMode({
            supabaseUrl: adminSupabaseUrl,
            supabaseServiceRoleKey,
        });
        const importDate = new Date().toISOString().slice(0, 10);
        const importTimestamp = new Date().toISOString();

        const cars = await insertInChunks(
            'cars',
            buildFleetCarSeedRows().map((car) => mapCarPayloadForSchema(car, coreMode)),
            'id, name'
        );

        const carIdByRegistration = new Map(
            cars.map((car) => {
                const match = /\(([A-Z0-9]+)\)\s*$/.exec(car.name);
                return [match ? match[1] : car.name, car.id];
            })
        );

        const { applications, rentals } = buildFleetDriverSeedRows({
            carIdByRegistration,
            importDate,
            importTimestamp,
        });

        const insertedApplications = await insertInChunks(
            'applications',
            applications.map((application) => mapApplicationPayloadForSchema(application, coreMode)),
            'id, email'
        );

        const applicationIdByEmail = new Map(
            insertedApplications.map((application) => [application.email, application.id])
        );

        await insertInChunks(
            'rentals',
            rentals.map((rental) => {
                const carId = carIdByRegistration.get(rental.registration);
                const applicationId = applicationIdByEmail.get(
                    `legacy-${rental.registration.toLowerCase()}@example.invalid`
                );

                if (!carId || !applicationId) {
                    throw new Error(`Missing seed ids for registration ${rental.registration}`);
                }

                return mapRentalPayloadForSchema(
                    {
                        car_id: carId,
                        application_id: applicationId,
                        start_date: rental.start_date,
                        weekly_price: rental.weekly_price,
                        bond_paid: rental.bond_paid,
                        status: rental.status,
                    },
                    coreMode
                );
            }),
            'id'
        );

        console.log(`Successfully seeded ${cars.length} cars and ${rentals.length} active rentals.`);
        process.exit(0);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST205') {
            console.error("ERROR: The required tables do not exist yet. Please run the SQL schema in the Supabase Dashboard first!");
            process.exit(1);
        }

        console.error("Error seeding fleet data:", error);
        process.exit(1);
    }
}

seedData();
