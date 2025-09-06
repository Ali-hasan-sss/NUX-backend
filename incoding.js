// encode.js

const password = 'AliHasan1992@&@';

const encodedPassword = encodeURIComponent(password);

console.log('Original:', password);
console.log('Encoded:', encodedPassword);

const host = 'db.gkksmfcijyeeuskfjguy.supabase.co';
const dbName = 'postgres';
const user = 'postgres';

const databaseUrl = `postgresql://${user}:${encodedPassword}@${host}:5432/${dbName}`;
console.log('DATABASE_URL:', databaseUrl);
