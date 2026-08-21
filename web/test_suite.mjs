
async function runFullTestSuite() {
  console.log("\n=======================================================");
  console.log("⚡ DEVNIX FULL COMPREHENSIVE LANGUAGE TEST SUITE ⚡");
  console.log("=======================================================\n");

  const baseUrl = "http://localhost:3000/api/execute";
  let passedCount = 0;
  let failedCount = 0;

  for (const lang of SUPPORTED_LANGUAGES) {
    process.stdout.write(`Testing [${lang.label.padEnd(24)}] ID: ${String(lang.id).padStart(2)} ... `);
    
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language_id: lang.id,
          source_code: lang.defaultCode,
        }),
      });

      if (!res.ok) {
        console.log(`❌ FAILED (HTTP ${res.status})`);
        failedCount++;
        continue;
      }

      const result = await res.json();

      if (result.status?.id === 3 && result.stdout && result.stdout.trim().length > 0) {
        console.log(`✅ PASSED (${result.time}s) -> Output length: ${result.stdout.trim().length} chars`);
        passedCount++;
      } else {
        console.log(`❌ FAILED -> Status: ${result.status?.description}`);
        if (result.stderr) {
          console.log(`   Error: ${result.stderr.trim()}`);
        }
        failedCount++;
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      failedCount++;
    }
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED / ${failedCount} FAILED out of ${SUPPORTED_LANGUAGES.length} LANGUAGES`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

// Quick check if languages.js is loadable or run directly with inline definitions
const languages = [
  { id: 71, label: "Python", defaultCode: "def greet(name):\n    return f'Hello, {name}! Welcome to Devnix ⚡'\nprint(greet('Developer'))" },
  { id: 63, label: "JavaScript (Node.js)", defaultCode: "console.log('⚡ JavaScript Execution on Devnix');" },
  { id: 74, label: "TypeScript", defaultCode: "const msg: string = '⚡ TypeScript on Devnix'; console.log(msg);" },
  { id: 54, label: "C++ (GCC)", defaultCode: "#include <iostream>\nint main() { std::cout << '⚡ C++ on Devnix' << std::endl; return 0; }" },
  { id: 50, label: "C (GCC)", defaultCode: "#include <stdio.h>\nint main() { printf('⚡ C on Devnix\\n'); return 0; }" },
  { id: 62, label: "Java (OpenJDK)", defaultCode: "public class Main { public static void main(String[] args) { System.out.println('⚡ Java on Devnix'); } }" },
  { id: 73, label: "Rust", defaultCode: "fn main() { println!('⚡ Rust on Devnix'); }" },
  { id: 60, label: "Go", defaultCode: "package main\nimport 'fmt'\nfunc main() { fmt.Println('⚡ Go on Devnix') }" },
  { id: 72, label: "Ruby", defaultCode: "puts '⚡ Ruby on Devnix'" },
  { id: 68, label: "PHP", defaultCode: "<?php echo '⚡ PHP on Devnix'; ?>" },
  { id: 46, label: "Bash", defaultCode: "echo '⚡ Bash on Devnix'" },
];

async function runDirectTest() {
  console.log("\n=======================================================");
  console.log("⚡ DEVNIX FULL COMPREHENSIVE LANGUAGE TEST SUITE ⚡");
  console.log("=======================================================\n");

  const baseUrl = "http://localhost:3000/api/execute";
  let passedCount = 0;
  let failedCount = 0;

  for (const lang of languages) {
    process.stdout.write(`Testing [${lang.label.padEnd(24)}] (ID: ${String(lang.id).padStart(2)}) ... `);
    
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language_id: lang.id,
          source_code: lang.defaultCode,
        }),
      });

      if (!res.ok) {
        console.log(`❌ FAILED (HTTP ${res.status})`);
        failedCount++;
        continue;
      }

      const result = await res.json();

      if (result.status?.id === 3 && result.stdout && result.stdout.trim().length > 0) {
        console.log(`✅ PASSED (${result.time}s)`);
        console.log(`   └─ Stdout: ${result.stdout.trim().replace(/\\n/g, " ")}`);
        passedCount++;
      } else {
        console.log(`❌ FAILED -> Status: ${result.status?.description}`);
        if (result.stderr) {
          console.log(`   Error: ${result.stderr.trim()}`);
        }
        failedCount++;
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      failedCount++;
    }
  }

  console.log("\n=======================================================");
  console.log(`RESULT: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${languages.length} LANGUAGES)`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runDirectTest();
