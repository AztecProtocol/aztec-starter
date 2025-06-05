import { readFileSync, writeFileSync } from 'fs';

// Read Nargo.toml
const nargoContent = readFileSync('Nargo.toml', 'utf8');
const versionMatch = nargoContent.match(/tag\s*=\s*"v([^"]+)"/);
const version = versionMatch ? versionMatch[1] : null;

if (!version) {
    console.error('Could not find version tag in Nargo.toml');
    process.exit(1);
}

// Read README.md
const readmePath = 'README.md';
let readmeContent = readFileSync(readmePath, 'utf8');

// Update the aztec-up version
const updatedContent = readmeContent.replace(
    /aztec-up \d+\.\d+\.\d+/,
    `aztec-up ${version}`
);

// Write back to README
writeFileSync(readmePath, updatedContent);
console.log(`Updated README.md with version ${version}`);
