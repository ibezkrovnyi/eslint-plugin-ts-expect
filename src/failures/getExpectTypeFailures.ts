import ts from "typescript";

import { Assertions } from "../assertions/types.js";
import { getNodeAtPosition } from "../utils/locations.js";
import { lineOfPosition } from "../utils/locations.js";
import {
	getLanguageServiceHost,
	getNodeForExpectType,
	matchModuloWhitespace,
} from "../utils/typescript.js";
import { normalizedTypeToString } from "./normalizedTypeToString.js";
import { ExpectTypeFailures, UnmetExpectation } from "./types.js";

export function getExpectTypeFailures(
	sourceFile: ts.SourceFile,
	assertions: Pick<Assertions, "twoSlashAssertions" | "typeAssertions">,
	program: ts.Program,
): ExpectTypeFailures {
	const checker = program.getTypeChecker();
	const languageService = ts.createLanguageService(
		getLanguageServiceHost(program),
	);
	const { twoSlashAssertions, typeAssertions } = assertions;
	const unmetExpectations: UnmetExpectation[] = [];

	// Match assertions to the first node that appears on the line they apply to.
	ts.forEachChild(sourceFile, function iterate(node) {
		const line = lineOfPosition(node.getStart(sourceFile), sourceFile);
		const assertion = typeAssertions.get(line);
		if (assertion !== undefined) {
			const { expected } = assertion;

			let nodeToCheck = node;

			// https://github.com/Microsoft/TypeScript/issues/14077
			if (node.kind === ts.SyntaxKind.ExpressionStatement) {
				node = (node as ts.ExpressionStatement).expression;
			}

			nodeToCheck = getNodeForExpectType(node);
			const type = checker.getTypeAtLocation(nodeToCheck);
			const actual = checker.typeToString(
				type,
				/*enclosingDeclaration*/ undefined,
				ts.TypeFormatFlags.NoTruncation,
			);

			typeAssertions.delete(line);

			const candidates = expected
				?.split(/\s*\|\|\s*/)
				.map((s) => s.trim())
				.filter(Boolean);

			if (!candidates || !candidateTypeMatches(actual, candidates)) {
				unmetExpectations.push({ actual, assertion, node });
			}
		}

		ts.forEachChild(node, iterate);
	});

	function candidateTypeMatches(actual: string, candidates: string[]) {
		let actualNormalized: string | undefined;

		for (const candidate of candidates) {
			if (candidate === actual) {
				return true;
			}

			actualNormalized ??= normalizedTypeToString(actual);
			const candidateNormalized = normalizedTypeToString(candidate);

			if (actualNormalized === candidateNormalized) {
				return true;
			}
		}

		return false;
	}

	const twoSlashFailureLines: number[] = [];
	if (twoSlashAssertions.length) {
		for (const assertion of twoSlashAssertions) {
			const { expected, position } = assertion;
			if (position === -1) {
				// special case for a twoslash assertion on line 1.
				twoSlashFailureLines.push(0);
				continue;
			}

			const node = getNodeAtPosition(sourceFile, position);
			if (!node) {
				twoSlashFailureLines.push(
					sourceFile.getLineAndCharacterOfPosition(position).line,
				);
				continue;
			}

			const qi = languageService.getQuickInfoAtPosition(
				sourceFile.fileName,
				node.getStart(),
			);
			if (!qi?.displayParts) {
				twoSlashFailureLines.push(
					sourceFile.getLineAndCharacterOfPosition(position).line,
				);
				continue;
			}

			const actual = qi.displayParts.map((dp) => dp.text).join("");
			if (!matchModuloWhitespace(actual, expected)) {
				unmetExpectations.push({
					actual,
					assertion,
					node,
				});
			}
		}
	}

	return {
		unmetExpectations,
		unusedAssertions: [...twoSlashFailureLines, ...typeAssertions.keys()],
	};
}
