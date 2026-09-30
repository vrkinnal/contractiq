import fs from 'node:fs';

const envDirectory = './src/environments';
const targetPath = './src/environments/environment.ts';

// Create folder if it doesn't exist
if (!fs.existsSync(envDirectory)) {
  fs.mkdirSync(envDirectory, { recursive: true });
}

// Write your Vercel keys into environment.ts
const envConfigFile = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.SUPABASE_URL || ""}',
  supabaseKey: '${process.env.SUPABASE_KEY || ""}'
};
`;

fs.writeFileSync(targetPath, envConfigFile);
console.log('Environment configuration generated successfully for environment.ts');