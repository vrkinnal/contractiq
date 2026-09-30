const fs = require('fs');

const envDirectory = './src/environments';
const targetPath = './src/environments/environment.ts';
const targetProdPath = './src/environments/environment.prod.ts';

// Ensure the directory exists
if (!fs.existsSync(envDirectory)) {
  fs.mkdirSync(envDirectory, { recursive: true });
}

// Generate the environment file content using Vercel's environment variables
const envConfigFile = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.SUPABASE_URL || ""}',
  supabaseKey: '${process.env.SUPABASE_KEY || ""}'
};
`;

// Write to both environment files
fs.writeFileSync(targetPath, envConfigFile);
if (fs.existsSync(targetProdPath)) {
  fs.writeFileSync(targetProdPath, envConfigFile);
}

console.log('Environment configuration generated successfully.');