import fs from 'node:fs';

const envDirectory = './src/environments';
const targetPath = './src/environments/environment.ts';

if (!fs.existsSync(envDirectory)) {
  fs.mkdirSync(envDirectory, { recursive: true });
}

// In Node, process.env keys match whatever variable names you saved in Vercel
const envConfigFile = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.supabaseUrl || process.env.SUPABASE_URL || ""}',
  supabaseAnonKey: '${process.env.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || ""}'
};
`;

fs.writeFileSync(targetPath, envConfigFile);
console.log('Environment configuration generated successfully.');