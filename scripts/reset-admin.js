import './load-env.js';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const args = process.argv.slice(2);
const createIfMissing = args.includes('--create-if-missing');
const positionalArgs = args.filter((arg) => arg !== '--create-if-missing');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
    realtime: {
        transport: WebSocket,
    },
});

async function resetAdmin() {
    const adminEmail = (positionalArgs[0] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const newPassword = positionalArgs[1] || process.env.ADMIN_PASSWORD || '';

    if (!adminEmail || !newPassword) {
        console.error("Usage: node scripts/reset-admin.js <adminEmail> <newPassword> [--create-if-missing]");
        console.error("Or set ADMIN_EMAIL and ADMIN_PASSWORD in environment.");
        process.exit(1);
    }

    console.log("Fetching user...");
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
    });

    if (error) {
        console.error("Error listing users:", error.message || error);
        process.exit(1);
    }

    const adminUser = users.find((user) => user.email?.toLowerCase() === adminEmail);

    if (!adminUser) {
        if (!createIfMissing) {
            console.error(`Admin user not found: ${adminEmail}`);
            console.error("Rerun with --create-if-missing to create the confirmed Supabase Auth user.");
            process.exit(2);
        }

        console.log(`Admin user not found. Creating confirmed admin user: ${adminEmail}`);
        const { error: createError } = await supabase.auth.admin.createUser({
            email: adminEmail,
            password: newPassword,
            email_confirm: true,
        });

        if (createError) {
            console.error("Error creating admin user:", createError.message || createError);
            process.exit(1);
        }

        console.log("Admin user created successfully.");
        return;
    }

    console.log(`Found admin user: ${adminUser.id}, updating password...`);

    const { error: updateError } = await supabase.auth.admin.updateUserById(
        adminUser.id,
        {
            email_confirm: true,
            password: newPassword,
        }
    );

    if (updateError) {
        console.error("Error updating user:", updateError.message || updateError);
        process.exit(1);
    }

    console.log("Password reset successfully!");
}

resetAdmin().catch((error) => {
    console.error("Admin reset failed:", error instanceof Error ? error.message : error);
    process.exit(1);
});
