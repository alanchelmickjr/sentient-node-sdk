# Guide: Using the 🧹 Optimizer Mode

The Optimizer mode (`refinement-optimization-mode`) is designed to help you improve existing code through refactoring, performance tuning, and reducing technical debt.

## 1. Purpose & Goals

Use the Optimizer when you want to:

*   **Refactor:** Improve code structure, readability, and maintainability without changing functionality.
*   **Optimize:** Enhance performance (speed, memory usage) or resource efficiency.
*   **Modularize:** Break down large components (over 500 lines recommended) into smaller, reusable units.
*   **Reduce Debt:** Clean up code smells, remove unused code/dependencies, and improve overall quality.
*   **Improve Config:** Externalize hardcoded configurations (e.g., to environment variables).

## 2. Workflow

The Optimizer typically follows these steps:

1.  **Analysis:** Examines code (`read_file`) to find areas for improvement.
2.  **Profiling (Optional):** May suggest running benchmarks (`execute_command`) to measure performance before optimizing.
3.  **Refactoring/Optimization:** Applies changes iteratively using `apply_diff`.
4.  **Validation:** May suggest running tests or benchmarks (`execute_command`) to confirm changes and measure improvements.

## 3. How to Interact Effectively

*   **Be Specific:** Provide clear, targeted requests.
    *   *Good:* "Refactor the `calculateTotal` function in `src/billing.ts` to improve clarity."
    *   *Less Good:* "Optimize this file."
*   **Provide Context:** Mention related files or the overall goal if the change might affect other parts of the system.
*   **Iterate:** Review the Optimizer's analysis and proposed changes. Guide it if needed and approve steps sequentially.
*   **Combine Modes:** Consider using `🧪 Tester (TDD)` to add tests before refactoring or `🛡️ Security Reviewer` afterwards.

## 4. Key Principles

*   **Measure First:** Establish baselines before performance optimization.
*   **Maintain Correctness:** Ensure functionality remains unchanged during refactoring (tests are crucial).
*   **Prioritize Maintainability:** Favor clear, simple code over complex micro-optimizations unless performance is critical and measured.
*   **Focus on Impact:** Target significant bottlenecks identified through analysis or profiling.

## 5. Example Scenario

```
You: "This class `src/data_processor.js` is over 600 lines. Please break it down into smaller modules."

Optimizer (Analysis): Analyzing `src/data_processor.js`. It handles data fetching, parsing, and transformation. I propose extracting parsing logic into `src/data_parser.js` and transformation logic into `src/data_transformer.js`.

Optimizer (Tool Selection): Using `apply_diff` to modify `src/data_processor.js` and `write_to_file` to create the new modules.

[... Tool Execution & User Validation for each step ...]

Optimizer (Report): Refactoring complete. `src/data_processor.js` now delegates to `src/data_parser.js` and `src/data_transformer.js`. Suggest running tests to validate.
```

By following these guidelines, you can effectively leverage the Optimizer mode to enhance the quality and performance of your codebase.