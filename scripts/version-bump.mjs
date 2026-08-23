/**
 * Runs on `npm version <x.y.z>`: copies the new version into manifest.json
 * and records it in versions.json against the current minAppVersion.
 */
import { readFileSync, writeFileSync } from "node:fs";

const version = process.env.npm_package_version;
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[version] = manifest.minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
console.log(`manifest.json and versions.json → ${version}`);
