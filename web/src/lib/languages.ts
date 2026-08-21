export interface Language {
  id: number;
  name: string;
  label: string;
  version: string;
  extension: string;
  monacoLang: string;
  badgeColor: string;
  defaultCode: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    id: 71,
    name: "python",
    label: "Python",
    version: "3.8.1",
    extension: "py",
    monacoLang: "python",
    badgeColor: "#ffe600",
    defaultCode: `# Python 3 Interactive Playground on Devnix
print("⚡ Welcome to Devnix Studio! ⚡")

name = input("👉 Enter your name: ")
print(f"Hello, {name}! Welcome aboard.")

num = int(input("👉 Enter a number to calculate its square: "))
print(f"Result: {num}² = {num * num}")
print("✓ Live execution finished successfully!")
`,
  },
  {
    id: 63,
    name: "javascript",
    label: "JavaScript (Node.js)",
    version: "12.14.0",
    extension: "js",
    monacoLang: "javascript",
    badgeColor: "#ffe600",
    defaultCode: `// JavaScript (Node.js) on Devnix
function generateReport(title, items) {
  console.log("=== " + title.toUpperCase() + " ===");
  items.forEach((item, index) => {
    console.log(\`[\${index + 1}] \${item}\`);
  });
}

const features = [
  "Neobrutalist Code Playground",
  "High Speed Execution",
  "Multi-language Compilers",
  "Powered by Judge0 & Next.js"
];

generateReport("Devnix Engine Features", features);
`,
  },
  {
    id: 74,
    name: "typescript",
    label: "TypeScript",
    version: "3.7.4",
    extension: "ts",
    monacoLang: "typescript",
    badgeColor: "#00f0ff",
    defaultCode: `// TypeScript on Devnix
interface ServerStats {
  server: string;
  status: "ONLINE" | "OFFLINE";
  uptimeHours: number;
}

const stats: ServerStats = {
  server: "Devnix Engine Alpha",
  status: "ONLINE",
  uptimeHours: 42
};

console.log("⚡ Devnix Server Status:", stats);
`,
  },
  {
    id: 54,
    name: "cpp",
    label: "C++ (GCC)",
    version: "9.2.0",
    extension: "cpp",
    monacoLang: "cpp",
    badgeColor: "#00f0ff",
    defaultCode: `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "⚡ Devnix C++ Runner ⚡" << std::endl;
    
    std::vector<int> numbers = {10, 20, 30, 40, 50};
    int sum = std::accumulate(numbers.begin(), numbers.end(), 0);
    
    std::cout << "Sum of elements: " << sum << std::endl;
    return 0;
}
`,
  },
  {
    id: 50,
    name: "c",
    label: "C (GCC)",
    version: "9.2.0",
    extension: "c",
    monacoLang: "c",
    badgeColor: "#b388ff",
    defaultCode: `#include <stdio.h>

int main() {
    printf("=== Welcome to Devnix C Runner ===\\n");
    for (int i = 1; i <= 5; i++) {
        printf("Step %d: Processing instruction...\\n", i);
    }
    printf("Done!\\n");
    return 0;
}
`,
  },
  {
    id: 62,
    name: "java",
    label: "Java (OpenJDK)",
    version: "13.0.1",
    extension: "java",
    monacoLang: "java",
    badgeColor: "#ff5277",
    defaultCode: `public class Main {
    public static void main(String[] args) {
        System.out.println("⚡ Hello from Java on Devnix! ⚡");
        int a = 15;
        int b = 35;
        System.out.println("Result: " + a + " + " + b + " = " + (a + b));
    }
}
`,
  },
  {
    id: 73,
    name: "rust",
    label: "Rust",
    version: "1.40.0",
    extension: "rs",
    monacoLang: "rust",
    badgeColor: "#ff9800",
    defaultCode: `fn main() {
    println!("⚡ Devnix Rust Execution ⚡");
    let message = "Safe, Fast, Neobrutal!";
    println!("Tagline: {}", message);
}
`,
  },
  {
    id: 60,
    name: "go",
    label: "Go",
    version: "1.13.5",
    extension: "go",
    monacoLang: "go",
    badgeColor: "#00f0ff",
    defaultCode: `package main

import "fmt"

func main() {
    fmt.Println("⚡ Hello from Go on Devnix! ⚡")
    tasks := []string{"Build UI", "Connect Judge0", "Ship Devnix"}
    for i, task := range tasks {
        fmt.Printf("[%d] %s\\n", i+1, task)
    }
}
`,
  },
  {
    id: 72,
    name: "ruby",
    label: "Ruby",
    version: "2.7.0",
    extension: "rb",
    monacoLang: "ruby",
    badgeColor: "#ff5277",
    defaultCode: `# Ruby on Devnix
puts "⚡ Devnix Ruby Runner"
gems = ["rails", "sinatra", "devnix-engine"]
gems.each { |g| puts "-> Loading #{g}..." }
puts "All gems initialized!"
`,
  },
  {
    id: 68,
    name: "php",
    label: "PHP",
    version: "7.4.1",
    extension: "php",
    monacoLang: "php",
    badgeColor: "#b388ff",
    defaultCode: `<?php
echo "⚡ Devnix PHP Execution Engine\n";
$arr = ["Fast", "Reliable", "Interactive"];
echo "Attributes: " . implode(", ", $arr) . "\n";
?>
`,
  },
  {
    id: 46,
    name: "bash",
    label: "Bash",
    version: "5.0.0",
    extension: "sh",
    monacoLang: "shell",
    badgeColor: "#4ade80",
    defaultCode: `#!/bin/bash
echo "⚡ Running Bash on Devnix"
echo "Host: $(uname -a)"
echo "Current Date: $(date)"
`,
  }
];
