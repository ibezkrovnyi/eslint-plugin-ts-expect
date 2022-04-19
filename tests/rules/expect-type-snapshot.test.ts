import dedent from 'dedent';
import { runRuleTests } from '../helpers/configs';

runRuleTests({
  valid: [
    // Snapshot matches.
    {
      code: dedent`
      // $ExpectTypeSnapshot SnapshotMatches
      const c = { a: 15, b: "b" as const, c: "c" };
    `,
      options: [{ disableExpectTypeSnapshotFix: true }],
    },
  ],
  invalid: [
    // Snapshot name is not specified
    {
      code: dedent`
      // $ExpectTypeSnapshot
      const Button = class {};
    `,
      options: [],
      errors: [
        {
          messageId: 'SyntaxError',
          line: 2,
          column: 1,
        },
      ],
    },
    {
      code: dedent`
      //$ExpectTypeSnapshot
      const Button = class {};
    `,
      options: [],
      errors: [
        {
          messageId: 'SyntaxError',
          line: 2,
          column: 1,
        },
      ],
    },
    // Snapshot not found. Suggestion to run eslint --fix to create snapshot.
    {
      code: dedent`
      // $ExpectTypeSnapshot snapshot-not-found
      const configA = { a: 15, b: "b" as const, c: "c" };
    `,
      options: [{ disableExpectTypeSnapshotFix: true }],
      errors: [
        {
          messageId: 'TypeSnapshotNotFound',
          line: 2,
          column: 1,
        },
      ],
    },
    // Snapshot has different type.
    {
      code: dedent`
      // $ExpectTypeSnapshot TypeSnapshotDoNotMatch
      const configB = { a: 15, b: "b" as const, c: "c" };
    `,
      options: [{ disableExpectTypeSnapshotFix: true }],
      errors: [
        {
          messageId: 'TypeSnapshotDoNotMatch',
          line: 2,
          column: 1,
        },
      ],
    },
  ],
});
