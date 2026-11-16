import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const problems = [];
for (const file of files) {
  if (/(^|\/)(\.private|secrets\.txt|\.env(?:\.|$))/.test(file)) {
    problems.push(file + ": forbidden private path");
    continue;
  }
  if (/\.(png|jpg|jpeg|webp|ico)$/i.test(file)) continue;
  const text = await readFile(file, "utf8");
  for (const [name, re] of [
    [
      "GitHub token",
      /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
    ],
    ["private key", /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
    ["credential URL", /https?:\/\/[^\s/@:]+:[^\s/@]+@/],
  ])
    if (re.test(text)) problems.push(file + ": " + name);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Secret pattern scan passed for " +
      files.length +
      " tracked files. Review and local credential comparison are also required.",
  );
