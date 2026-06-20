import './load-env.js';
import { db } from '../api/db/index.js';

type BucketConfig = {
    allowedMimeTypes?: string[];
    fileSizeLimit: number;
    name: string;
    public: boolean;
};

const BUCKETS: BucketConfig[] = [
    {
        name: 'applications',
        public: false,
        fileSizeLimit: 10485760,
    },
    {
        name: process.env.SUPABASE_VEHICLE_IMAGES_BUCKET?.trim() || 'vehicle-images',
        public: true,
        fileSizeLimit: 15728640,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
];

async function setupBucket() {
    const { data: buckets, error: listError } = await db.storage.listBuckets();
    if (listError) {
        console.error("Error listing buckets:", listError);
        process.exit(1);
    }

    for (const bucket of BUCKETS) {
        console.log(`Ensuring bucket "${bucket.name}" exists...`);

        const bucketExists = buckets.some(b => b.name === bucket.name);
        const options = {
            public: bucket.public,
            fileSizeLimit: bucket.fileSizeLimit,
            allowedMimeTypes: bucket.allowedMimeTypes,
        };

        if (!bucketExists) {
            const { error: createError } = await db.storage.createBucket(bucket.name, options);

            if (createError) {
                console.error(`Error creating bucket "${bucket.name}":`, createError);
                process.exit(1);
            }

            console.log(
                `Bucket "${bucket.name}" created successfully (${bucket.public ? 'Public' : 'Private'}).`
            );
            continue;
        }

        const { error: updateError } = await db.storage.updateBucket(bucket.name, options);

        if (updateError) {
            console.error(`Error updating bucket "${bucket.name}":`, updateError);
            process.exit(1);
        }

        console.log(
            `Bucket "${bucket.name}" already exists and has been configured as ${bucket.public ? 'public' : 'private'}.`
        );
    }
}

setupBucket();

