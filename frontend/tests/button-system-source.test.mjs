import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { relative, resolve, sep } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import * as ts from "typescript"

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url))

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), "utf8")
}

function createTsxSourceFile(relativePath, source) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
}

function jsxOpeningElements(sourceFile, tagName) {
  const result = []

  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      (!tagName || node.tagName.getText(sourceFile) === tagName)
    ) {
      result.push(node)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return result
}

function openingTags(source, tagName) {
  const sourceFile = createTsxSourceFile("source.tsx", source)
  return jsxOpeningElements(sourceFile, tagName).map((node) => node.getText(sourceFile))
}

function walkTsxFiles(directory = sourceRoot) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkTsxFiles(absolutePath))
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push({
        absolutePath,
        relativePath: relative(sourceRoot, absolutePath).split(sep).join("/"),
        source: readFileSync(absolutePath, "utf8"),
      })
    }
  }

  return files
}

const tsxInventory = walkTsxFiles()
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  .map((file) => ({
    ...file,
    sourceFile: createTsxSourceFile(file.relativePath, file.source),
  }))

function elementBlocks(source, tagName) {
  const result = []
  const openingNeedle = `<${tagName}`
  const closingNeedle = `</${tagName}>`
  let start = 0

  while ((start = source.indexOf(openingNeedle, start)) >= 0) {
    const end = source.indexOf(closingNeedle, start)
    assert.notEqual(end, -1, `${tagName} block starting at ${start}`)
    result.push(source.slice(start, end + closingNeedle.length))
    start = end + closingNeedle.length
  }

  return result
}

function assertMarkedNativeSurfaces(relativePath, expectedCount) {
  const tags = openingTags(readSource(relativePath), "button")
  assert.equal(tags.length, expectedCount, relativePath)
  for (const tag of tags) {
    assert.match(tag, /data-slot="interactive-surface"/, `${relativePath}: ${tag}`)
    assert.match(tag, /interactiveSurfaceClassName/, `${relativePath}: ${tag}`)
  }
}

function assertUsesShadcnButton(relativePath) {
  const source = readSource(relativePath)
  assert.match(source, /import \{ Button \} from "@\/components\/ui\/button";?/)
  assert.ok(openingTags(source, "Button").length > 0, relativePath)
}

function assertBusyButtons(relativePath, callbackNeedle, busyState, expectedCount) {
  const blocks = elementBlocks(readSource(relativePath), "Button").filter((block) =>
    block.includes(callbackNeedle)
  )
  assert.equal(blocks.length, expectedCount, `${relativePath}: ${callbackNeedle}`)

  for (const block of blocks) {
    const openingTag = openingTags(block, "Button")[0]
    assert.match(openingTag, new RegExp(`disabled=\\{${busyState}\\}`), block)
    assert.match(openingTag, new RegExp(`aria-busy=\\{${busyState}\\}`), block)
    assert.match(block, /<Spinner aria-label="加载中" \/>/, block)
  }
}

function sourceFileFor(relativePath, sourceOrSourceFile) {
  return typeof sourceOrSourceFile === "string"
    ? createTsxSourceFile(relativePath, sourceOrSourceFile)
    : sourceOrSourceFile
}

function jsxAttributes(element, sourceFile, attributeName) {
  return element.attributes.properties.filter(
    (property) =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === attributeName
  )
}

function mergeStaticStrings(...results) {
  return {
    values: results.flatMap((result) => result.values),
    unresolved: results.flatMap((result) => result.unresolved),
  }
}

function unwrapExpression(expression) {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrapExpression(expression.expression)
  }
  return expression
}

function resolveStaticStrings(expression, sourceFile) {
  const unwrapped = unwrapExpression(expression)
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return { values: [unwrapped.text], unresolved: [] }
  }
  if (
    unwrapped.kind === ts.SyntaxKind.NullKeyword ||
    unwrapped.kind === ts.SyntaxKind.TrueKeyword ||
    unwrapped.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isIdentifier(unwrapped) && unwrapped.text === "undefined")
  ) {
    return { values: [], unresolved: [] }
  }
  if (ts.isConditionalExpression(unwrapped)) {
    return mergeStaticStrings(
      resolveStaticStrings(unwrapped.whenTrue, sourceFile),
      resolveStaticStrings(unwrapped.whenFalse, sourceFile)
    )
  }
  if (ts.isBinaryExpression(unwrapped)) {
    if (unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return resolveStaticStrings(unwrapped.right, sourceFile)
    }
    if (
      unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return mergeStaticStrings(
        resolveStaticStrings(unwrapped.left, sourceFile),
        resolveStaticStrings(unwrapped.right, sourceFile)
      )
    }
    if (unwrapped.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = resolveStaticStrings(unwrapped.left, sourceFile)
      const right = resolveStaticStrings(unwrapped.right, sourceFile)
      if (left.unresolved.length === 0 && right.unresolved.length === 0) {
        return {
          values: left.values.flatMap((leftValue) =>
            right.values.map((rightValue) => `${leftValue}${rightValue}`)
          ),
          unresolved: [],
        }
      }
      return mergeStaticStrings(left, right)
    }
  }
  if (ts.isTemplateExpression(unwrapped)) {
    let values = [unwrapped.head.text]
    const unresolved = []
    for (const span of unwrapped.templateSpans) {
      const expressionResult = resolveStaticStrings(span.expression, sourceFile)
      unresolved.push(...expressionResult.unresolved)
      if (expressionResult.values.length === 0) {
        values = values.map((value) => `${value}${span.literal.text}`)
      } else {
        values = values.flatMap((value) =>
          expressionResult.values.map(
            (expressionValue) => `${value}${expressionValue}${span.literal.text}`
          )
        )
      }
    }
    return { values, unresolved }
  }
  return { values: [], unresolved: [unwrapped.getText(sourceFile)] }
}

function resolveJsxAttributeStrings(attribute, sourceFile) {
  if (!attribute.initializer) {
    return { values: [], unresolved: [attribute.getText(sourceFile)] }
  }
  if (ts.isStringLiteral(attribute.initializer)) {
    return { values: [attribute.initializer.text], unresolved: [] }
  }
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return resolveStaticStrings(attribute.initializer.expression, sourceFile)
  }
  return { values: [], unresolved: [attribute.initializer.getText(sourceFile)] }
}

function staticPropertyName(name, sourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return { value: name.text, unresolved: false }
  }
  if (ts.isComputedPropertyName(name)) {
    const result = resolveStaticStrings(name.expression, sourceFile)
    if (result.unresolved.length === 0 && result.values.length === 1) {
      return { value: result.values[0], unresolved: false }
    }
  }
  return { value: "", unresolved: true }
}

function inspectRoleSpread(expression, sourceFile) {
  const unwrapped = unwrapExpression(expression)
  if (ts.isObjectLiteralExpression(unwrapped)) {
    const roles = []
    const unresolved = []
    for (const property of unwrapped.properties) {
      if (ts.isSpreadAssignment(property)) {
        const nested = inspectRoleSpread(property.expression, sourceFile)
        roles.push(...nested.roles)
        unresolved.push(...nested.unresolved)
        continue
      }
      const name = staticPropertyName(property.name, sourceFile)
      if (name.unresolved) {
        unresolved.push(property.getText(sourceFile))
        continue
      }
      if (name.value !== "role") continue
      if (ts.isPropertyAssignment(property)) {
        const result = resolveStaticStrings(property.initializer, sourceFile)
        roles.push(...result.values)
        unresolved.push(...result.unresolved)
      } else {
        unresolved.push(property.getText(sourceFile))
      }
    }
    return { roles, unresolved }
  }
  if (ts.isConditionalExpression(unwrapped)) {
    const whenTrue = inspectRoleSpread(unwrapped.whenTrue, sourceFile)
    const whenFalse = inspectRoleSpread(unwrapped.whenFalse, sourceFile)
    return {
      roles: [...whenTrue.roles, ...whenFalse.roles],
      unresolved: [...whenTrue.unresolved, ...whenFalse.unresolved],
    }
  }
  if (ts.isBinaryExpression(unwrapped)) {
    if (unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return inspectRoleSpread(unwrapped.right, sourceFile)
    }
    if (
      unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      const left = inspectRoleSpread(unwrapped.left, sourceFile)
      const right = inspectRoleSpread(unwrapped.right, sourceFile)
      return {
        roles: [...left.roles, ...right.roles],
        unresolved: [...left.unresolved, ...right.unresolved],
      }
    }
  }
  if (
    unwrapped.kind === ts.SyntaxKind.NullKeyword ||
    unwrapped.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isIdentifier(unwrapped) && unwrapped.text === "undefined")
  ) {
    return { roles: [], unresolved: [] }
  }
  return { roles: [], unresolved: [unwrapped.getText(sourceFile)] }
}

const businessRoleExpressionAllowlist = new Map()
const businessIntrinsicSpreadAllowlist = new Map()

function isAllowlisted(allowlist, relativePath, expression) {
  return allowlist.get(relativePath)?.has(expression) ?? false
}

function inspectBusinessRoles(relativePath, sourceOrSourceFile) {
  const sourceFile = sourceFileFor(relativePath, sourceOrSourceFile)
  const roleButtons = []
  const violations = []

  for (const element of jsxOpeningElements(sourceFile)) {
    const tagName = element.tagName.getText(sourceFile)
    const intrinsic = /^[a-z][a-z0-9.-]*$/.test(tagName)

    const resolvedRoles = []
    for (const property of element.attributes.properties) {
      if (ts.isJsxSpreadAttribute(property)) {
        if (!intrinsic) continue
        const spread = inspectRoleSpread(property.expression, sourceFile)
        resolvedRoles.push(...spread.roles)
        for (const unresolved of spread.unresolved) {
          if (!isAllowlisted(businessIntrinsicSpreadAllowlist, relativePath, unresolved)) {
            violations.push(
              `${relativePath}: unresolved intrinsic spread attributes on <${tagName}>: ${unresolved}`
            )
          }
        }
        continue
      }
      if (property.name.getText(sourceFile) !== "role") continue
      const role = resolveJsxAttributeStrings(property, sourceFile)
      resolvedRoles.push(...role.values)
      for (const unresolved of role.unresolved) {
        if (!isAllowlisted(businessRoleExpressionAllowlist, relativePath, unresolved)) {
          violations.push(`${relativePath}: unresolved role on <${tagName}>: ${unresolved}`)
        }
      }
    }

    if (resolvedRoles.some((role) => role.trim().toLowerCase() === "button")) {
      roleButtons.push({
        relativePath,
        tagName,
        tag: element.getText(sourceFile),
        element,
        sourceFile,
      })
    }
  }

  return { roleButtons, violations }
}

function collectClassExpression(expression, sourceFile) {
  const tokens = []
  const unresolved = []
  const addTokens = (value) => tokens.push(...value.split(/\s+/).filter(Boolean))

  function collect(candidate) {
    const unwrapped = unwrapExpression(candidate)
    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
      addTokens(unwrapped.text)
      return
    }
    if (
      unwrapped.kind === ts.SyntaxKind.NullKeyword ||
      unwrapped.kind === ts.SyntaxKind.TrueKeyword ||
      unwrapped.kind === ts.SyntaxKind.FalseKeyword ||
      ts.isNumericLiteral(unwrapped) ||
      (ts.isIdentifier(unwrapped) && unwrapped.text === "undefined")
    ) {
      return
    }
    if (ts.isTemplateExpression(unwrapped)) {
      const result = resolveStaticStrings(unwrapped, sourceFile)
      result.values.forEach(addTokens)
      unresolved.push(...result.unresolved)
      return
    }
    if (ts.isConditionalExpression(unwrapped)) {
      collect(unwrapped.whenTrue)
      collect(unwrapped.whenFalse)
      return
    }
    if (ts.isBinaryExpression(unwrapped)) {
      if (unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        collect(unwrapped.right)
        return
      }
      if (
        unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        collect(unwrapped.left)
        collect(unwrapped.right)
        return
      }
      if (unwrapped.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const result = resolveStaticStrings(unwrapped, sourceFile)
        result.values.forEach(addTokens)
        unresolved.push(...result.unresolved)
        return
      }
    }
    if (ts.isCallExpression(unwrapped)) {
      const callee = unwrapped.expression.getText(sourceFile)
      if (callee === "cn" || callee === "clsx") {
        unwrapped.arguments.forEach(collect)
      } else {
        unresolved.push(unwrapped.getText(sourceFile))
      }
      return
    }
    if (ts.isArrayLiteralExpression(unwrapped)) {
      for (const element of unwrapped.elements) {
        if (ts.isSpreadElement(element)) unresolved.push(element.getText(sourceFile))
        else collect(element)
      }
      return
    }
    if (ts.isObjectLiteralExpression(unwrapped)) {
      for (const property of unwrapped.properties) {
        if (ts.isSpreadAssignment(property)) {
          unresolved.push(property.getText(sourceFile))
          continue
        }
        const name = staticPropertyName(property.name, sourceFile)
        if (name.unresolved) unresolved.push(property.getText(sourceFile))
        else addTokens(name.value)
      }
      return
    }
    unresolved.push(unwrapped.getText(sourceFile))
  }

  collect(expression)
  return { tokens, unresolved }
}

const buttonClassForwardingAllowlist = new Map([
  ["components/photo/DownloadButton.tsx", new Set(["className"])],
  ["components/post/PostVisibilityMenu.tsx", new Set(["buttonClassName"])],
])
const buttonSizeExpressionAllowlist = new Map()
const buttonSpreadAllowlist = new Map()

const tailwindPaletteColors = new Set([
  "amber",
  "black",
  "blue",
  "cyan",
  "emerald",
  "fuchsia",
  "gray",
  "green",
  "indigo",
  "lime",
  "neutral",
  "orange",
  "pink",
  "purple",
  "red",
  "rose",
  "sky",
  "slate",
  "stone",
  "teal",
  "violet",
  "white",
  "yellow",
  "zinc",
])

function baseUtility(classToken) {
  let bracketDepth = 0
  let parenthesisDepth = 0
  let lastVariantSeparator = -1
  for (let index = 0; index < classToken.length; index += 1) {
    const char = classToken[index]
    if (char === "[") bracketDepth += 1
    else if (char === "]") bracketDepth -= 1
    else if (char === "(") parenthesisDepth += 1
    else if (char === ")") parenthesisDepth -= 1
    else if (char === ":" && bracketDepth === 0 && parenthesisDepth === 0) {
      lastVariantSeparator = index
    }
  }
  return classToken
    .slice(lastVariantSeparator + 1)
    .replace(/^!/, "")
    .replace(/!$/, "")
}

function forbiddenButtonClassReason(classToken) {
  const utility = baseUtility(classToken)
  if (/^h-\[.+\]$/.test(utility)) return "arbitrary height"
  if (/^h-(?:[6-9]|1[0-2])$/.test(utility)) return "fixed height h-6 through h-12"
  if (/^rounded(?:-.+)?$/.test(utility)) return "rounded styling"
  if (/^(?:px|pl|pr|ps|pe)-.+$/.test(utility)) return "horizontal padding"

  const color = /^(?:bg|text|border|ring)-(.+)$/.exec(utility)
  if (!color) return ""
  const colorValue = color[1].split("/")[0]
  if (colorValue.startsWith("[") || colorValue.startsWith("(")) {
    return "arbitrary color"
  }
  if (tailwindPaletteColors.has(colorValue.split("-")[0])) {
    return "non-semantic palette color"
  }
  return ""
}

function inspectBusinessButtons(relativePath, sourceOrSourceFile) {
  const sourceFile = sourceFileFor(relativePath, sourceOrSourceFile)
  const violations = []

  for (const element of jsxOpeningElements(sourceFile, "Button")) {
    const tag = element.getText(sourceFile)
    for (const property of element.attributes.properties) {
      if (!ts.isJsxSpreadAttribute(property)) continue
      const expression = property.expression.getText(sourceFile)
      if (!isAllowlisted(buttonSpreadAllowlist, relativePath, expression)) {
        violations.push(`${relativePath}: Button spread attributes are not allowed: ${tag}`)
      }
    }

    for (const className of jsxAttributes(element, sourceFile, "className")) {
      let classes = { tokens: [], unresolved: [] }
      if (className.initializer && ts.isStringLiteral(className.initializer)) {
        classes.tokens = className.initializer.text.split(/\s+/).filter(Boolean)
      } else if (
        className.initializer &&
        ts.isJsxExpression(className.initializer) &&
        className.initializer.expression
      ) {
        classes = collectClassExpression(className.initializer.expression, sourceFile)
      } else {
        classes.unresolved.push(className.getText(sourceFile))
      }

      for (const unresolved of classes.unresolved) {
        if (!isAllowlisted(buttonClassForwardingAllowlist, relativePath, unresolved)) {
          violations.push(`${relativePath}: unresolved className expression: ${unresolved}`)
        }
      }
      for (const classToken of classes.tokens) {
        const reason = forbiddenButtonClassReason(classToken)
        if (reason) violations.push(`${relativePath}: ${reason}: ${classToken}`)
      }
    }

    const hasDirectAriaLabel = jsxAttributes(element, sourceFile, "aria-label").length > 0
    for (const size of jsxAttributes(element, sourceFile, "size")) {
      const result = resolveJsxAttributeStrings(size, sourceFile)
      for (const unresolved of result.unresolved) {
        if (!isAllowlisted(buttonSizeExpressionAllowlist, relativePath, unresolved)) {
          violations.push(`${relativePath}: unresolved size expression: ${unresolved}`)
        }
      }
      if (
        result.values.some((value) => value.trim().startsWith("icon")) &&
        !hasDirectAriaLabel
      ) {
        violations.push(`${relativePath}: icon Button requires direct aria-label: ${tag}`)
      }
    }
  }

  return violations
}

function hasStaticJsxAttribute(element, sourceFile, attributeName, expectedValue) {
  return jsxAttributes(element, sourceFile, attributeName).some((attribute) => {
    if (!attribute.initializer) return false
    if (ts.isStringLiteral(attribute.initializer)) {
      return attribute.initializer.text === expectedValue
    }
    if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) {
      return false
    }
    const expression = unwrapExpression(attribute.initializer.expression)
    return (
      (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) &&
      expression.text === expectedValue
    )
  })
}

function hasSharedInteractiveClass(element, sourceFile) {
  return jsxAttributes(element, sourceFile, "className").some(
    (attribute) => {
      if (
        !attribute.initializer ||
        !ts.isJsxExpression(attribute.initializer) ||
        !attribute.initializer.expression
      ) {
        return false
      }
      const expression = unwrapExpression(attribute.initializer.expression)
      if (
        ts.isIdentifier(expression) &&
        expression.text === "interactiveSurfaceClassName"
      ) {
        return true
      }
      if (!ts.isCallExpression(expression) || expression.expression.getText(sourceFile) !== "cn") {
        return false
      }
      return expression.arguments.some((argument) => {
        const unwrapped = unwrapExpression(argument)
        return (
          ts.isIdentifier(unwrapped) &&
          unwrapped.text === "interactiveSurfaceClassName"
        )
      })
    }
  )
}

test("AST role mutation fixtures enforce direct semantic attributes", () => {
  const expressionRole = inspectBusinessRoles(
    "fixtures/ExpressionRole.tsx",
    '<div role={"button"} data-slot="interactive-surface" className={cn(interactiveSurfaceClassName)} />'
  )
  assert.equal(expressionRole.roleButtons.length, 1)

  const dynamicRole = inspectBusinessRoles(
    "fixtures/DynamicRole.tsx",
    "<div role={dynamicRole} />"
  )
  assert.match(dynamicRole.violations.join("\n"), /unresolved role/)

  const spreadRole = inspectBusinessRoles(
    "fixtures/SpreadRole.tsx",
    "<div {...roleProps} />"
  )
  assert.match(spreadRole.violations.join("\n"), /unresolved intrinsic spread attributes/)

  const customRole = inspectBusinessRoles(
    "fixtures/CustomRole.tsx",
    '<Card role={"button"} onClick={() => undefined} />'
  )
  assert.equal(customRole.roleButtons.length, 1)

  const dynamicCustomRole = inspectBusinessRoles(
    "fixtures/DynamicCustomRole.tsx",
    "<Card role={dynamicRole} />"
  )
  assert.match(dynamicCustomRole.violations.join("\n"), /unresolved role/)

  const conditionalMarkersSource = createTsxSourceFile(
    "fixtures/ConditionalMarkers.tsx",
    '<button data-slot={active ? "interactive-surface" : "other"} className={cn(active && interactiveSurfaceClassName, "gap-2")} />'
  )
  const conditionalMarkers = jsxOpeningElements(conditionalMarkersSource, "button")[0]
  assert.equal(
    hasStaticJsxAttribute(
      conditionalMarkers,
      conditionalMarkersSource,
      "data-slot",
      "interactive-surface"
    ),
    false
  )
  assert.equal(hasSharedInteractiveClass(conditionalMarkers, conditionalMarkersSource), false)
})

test("AST Button mutation fixtures enforce direct semantic attributes", () => {
  assert.match(
    inspectBusinessButtons(
      "fixtures/DynamicClass.tsx",
      "<Button className={businessButtonClass}>操作</Button>"
    ).join("\n"),
    /unresolved className/
  )
  assert.match(
    inspectBusinessButtons(
      "fixtures/SpreadButton.tsx",
      "<Button {...dangerButtonProps}>操作</Button>"
    ).join("\n"),
    /spread attributes/
  )

  const colorViolations = inspectBusinessButtons(
    "fixtures/PaletteColors.tsx",
    '<Button className="bg-cyan-500 border-blue-500 ring-blue-500 bg-[#00ffff]">操作</Button>'
  ).join("\n")
  assert.match(colorViolations, /bg-cyan-500/)
  assert.match(colorViolations, /border-blue-500/)
  assert.match(colorViolations, /ring-blue-500/)
  assert.match(colorViolations, /bg-\[#00ffff\]/)

  const importantHeightViolations = inspectBusinessButtons(
    "fixtures/TrailingImportantHeight.tsx",
    '<Button className="h-8! h-[40px]!">操作</Button>'
  ).join("\n")
  assert.match(importantHeightViolations, /h-8!/)
  assert.match(importantHeightViolations, /h-\[40px\]!/)

  assert.match(
    inspectBusinessButtons(
      "fixtures/ExpressionIconSize.tsx",
      '<Button size={"icon-sm"}>操作</Button>'
    ).join("\n"),
    /aria-label/
  )
  assert.match(
    inspectBusinessButtons(
      "fixtures/DynamicSize.tsx",
      "<Button size={iconSize}>操作</Button>"
    ).join("\n"),
    /unresolved size/
  )
  assert.deepEqual(
    inspectBusinessButtons(
      "fixtures/NestedProp.tsx",
      '<Button tooltip={<span className="bg-blue-500" />} className="gap-2">操作</Button>'
    ),
    []
  )
})

test("button foundations keep shadcn Button and provide Spinner plus interactive surface states", () => {
  const button = readSource("components/ui/button.tsx")
  const spinner = readSource("components/ui/spinner.tsx")
  const surface = readSource("lib/interactive-surface.ts")

  const buttonSha256 = createHash("sha256")
    .update(button.replaceAll("\r\n", "\n"))
    .digest("hex")

  assert.equal(
    buttonSha256,
    "d14549ab3ba7a9d5d1f424c2599233bffa0b317121abf3b6efa2fb902d5e2781",
    "components/ui/button.tsx must remain exactly the approved generated shadcn base-nova Button"
  )
  assert.match(spinner, /import \{ Loader2Icon \} from "lucide-react"/)
  assert.match(
    spinner,
    /<Loader2Icon data-slot="spinner" role="status" aria-label="Loading" className=\{cn\("size-4 animate-spin", className\)\} \{\.\.\.props\} \/>/
  )
  assert.equal(
    surface,
    `const interactiveSurfaceClassName =
  "outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export { interactiveSurfaceClassName }
`
  )
})

test("all business native buttons and role buttons use the registered interaction surface", () => {
  const businessFiles = tsxInventory.filter(
    ({ relativePath }) => !relativePath.startsWith("components/ui/")
  )
  const nativeButtons = businessFiles.flatMap(({ relativePath, sourceFile }) =>
    jsxOpeningElements(sourceFile, "button").map((element) => ({
      relativePath,
      sourceFile,
      element,
      tag: element.getText(sourceFile),
    }))
  )

  assert.equal(
    nativeButtons.length,
    23,
    nativeButtons.map(({ relativePath, tag }) => `${relativePath}: ${tag}`).join("\n")
  )
  for (const { relativePath, sourceFile, element, tag } of nativeButtons) {
    assert.equal(
      hasStaticJsxAttribute(element, sourceFile, "data-slot", "interactive-surface"),
      true,
      `${relativePath}: ${tag}`
    )
    assert.equal(hasSharedInteractiveClass(element, sourceFile), true, `${relativePath}: ${tag}`)
  }

  const sidebar = tsxInventory.find(
    ({ relativePath }) => relativePath === "components/ui/sidebar.tsx"
  )
  assert.ok(sidebar, "components/ui/sidebar.tsx must remain in the TSX inventory")
  const sidebarNativeButtons = jsxOpeningElements(sidebar.sourceFile, "button")
  assert.equal(sidebarNativeButtons.length, 1, "SidebarRail must remain the only sidebar button")

  const totalNativeButtons = tsxInventory.reduce(
    (count, { sourceFile }) => count + jsxOpeningElements(sourceFile, "button").length,
    0
  )
  assert.equal(nativeButtons.length + sidebarNativeButtons.length, 24)
  assert.equal(totalNativeButtons, 24)

  const roleInspections = businessFiles.map(({ relativePath, sourceFile }) =>
    inspectBusinessRoles(relativePath, sourceFile)
  )
  assert.deepEqual(roleInspections.flatMap(({ violations }) => violations), [])
  const roleButtons = roleInspections.flatMap(({ roleButtons: resolved }) => resolved)
  assert.deepEqual(
    roleButtons.map(({ relativePath }) => relativePath),
    ["components/upload/UploadDialog.tsx"]
  )
  assert.equal(
    hasStaticJsxAttribute(
      roleButtons[0].element,
      roleButtons[0].sourceFile,
      "data-slot",
      "interactive-surface"
    ),
    true
  )
  assert.equal(
    hasSharedInteractiveClass(roleButtons[0].element, roleButtons[0].sourceFile),
    true
  )
})

test("business Button calls do not recreate visual systems", () => {
  const businessFiles = tsxInventory.filter(
    ({ relativePath }) => !relativePath.startsWith("components/ui/")
  )
  const violations = businessFiles.flatMap(({ relativePath, sourceFile }) =>
    inspectBusinessButtons(relativePath, sourceFile)
  )

  assert.deepEqual(violations, [])
})

test("retired page-specific button CSS is removed", () => {
  const css = readSource("index.css")

  assert.doesNotMatch(css, /discover-layout-switch__button/)
  assert.doesNotMatch(css, /discover-feedback__button/)
  assert.doesNotMatch(css, /discover-inline-error button/)
  assert.doesNotMatch(css, /search-clear-button/)
  assert.doesNotMatch(css, /discover-filter__target/)
  assert.doesNotMatch(css, /discover-category-picker/)
  assert.doesNotMatch(css, /discover-category-target/)
})

test("public discovery and search keep only registered native interaction surfaces", () => {
  assertMarkedNativeSurfaces("pages/DiscoverPage.tsx", 0)
  assertMarkedNativeSurfaces("pages/SearchPage.tsx", 3)
  assertMarkedNativeSurfaces("pages/CommunityPage.tsx", 2)
  assertMarkedNativeSurfaces("components/home/InfiniteGallery.tsx", 0)
  assertMarkedNativeSurfaces("components/discover/DiscoverPictureCard.tsx", 1)
  assert.match(
    readSource("components/discover/DiscoverPictureCard.tsx"),
    /focus-visible:ring-inset/
  )
})

test("shell and auth use shadcn actions and keep notification rows as surfaces", () => {
  const taskFiles = [
    "components/Navbar.tsx",
    "components/auth/AuthDialog.tsx",
    "components/notifications/NotificationBell.tsx",
    "pages/NotificationsPage.tsx",
  ]
  const navbar = readSource(taskFiles[0])
  const auth = readSource(taskFiles[1])
  const notificationBell = readSource(taskFiles[2])
  const notifications = readSource(taskFiles[3])

  for (const relativePath of taskFiles.slice(0, 3)) {
    assertUsesShadcnButton(relativePath)
  }

  assertMarkedNativeSurfaces(taskFiles[0], 0)
  assertMarkedNativeSurfaces(taskFiles[1], 0)
  assertMarkedNativeSurfaces(taskFiles[2], 1)
  assertMarkedNativeSurfaces(taskFiles[3], 1)

  const bellTrigger = openingTags(notificationBell, "Button").find((tag) =>
    tag.includes('aria-label="通知"')
  )
  assert.ok(bellTrigger, "NotificationBell must expose a shadcn bell trigger")
  assert.match(bellTrigger, /variant="ghost"/)
  assert.match(bellTrigger, /size="icon-lg"/)
  assert.match(
    notificationBell,
    /className="absolute -right-1 -top-1 min-w-4 rounded-full/
  )

  const desktopAuthButtons = openingTags(navbar, "Button").filter((tag) =>
    tag.includes("onClick={() => setAuthOpen(true)}")
  )
  assert.equal(desktopAuthButtons.length, 2)
  for (const tag of desktopAuthButtons) {
    assert.doesNotMatch(tag, /size="sm"/)
  }

  assert.match(auth, /import \{ Spinner \} from "@\/components\/ui\/spinner"/)
  assert.equal(openingTags(auth, "Spinner").length, 2)
  assert.match(auth, /aria-busy=\{loading === "login"\}/)
  assert.match(auth, /aria-busy=\{loading === "register"\}/)

  assert.match(notifications, /import \{ Spinner \} from "@\/components\/ui\/spinner"/)
  const loadMore = elementBlocks(notifications, "Button").find((block) =>
    block.includes('loadNotifications("append")')
  )
  assert.ok(loadMore, "NotificationsPage must expose a load-more Button")
  assert.match(openingTags(loadMore, "Button")[0], /disabled=\{loading\}/)
  assert.match(openingTags(loadMore, "Button")[0], /aria-busy=\{loading\}/)
  assert.match(loadMore, /<Spinner aria-label="加载中" \/>/)
})

test("account post upload and media actions use Button while semantic surfaces remain native", () => {
  const taskFiles = [
    "pages/AccountDetailPage.tsx",
    "components/post/PostComposerDialog.tsx",
    "components/post/PostImageAttach.tsx",
    "components/post/PostCard.tsx",
    "components/post/PostVisibilityMenu.tsx",
    "components/upload/UploadDialog.tsx",
    "components/photo/PhotoStats.tsx",
    "components/photo/PhotoDetailDialog.tsx",
    "components/photo/PhotographerInfo.tsx",
    "components/photo/DownloadButton.tsx",
    "components/ImagePreviewModal.tsx",
  ]

  for (const relativePath of taskFiles) {
    assertUsesShadcnButton(relativePath)
    for (const tag of openingTags(readSource(relativePath), "Spinner")) {
      assert.match(tag, /aria-label="加载中"/, `${relativePath}: ${tag}`)
    }
  }

  assertMarkedNativeSurfaces("pages/AccountDetailPage.tsx", 2)
  assertMarkedNativeSurfaces("components/post/PostComposerDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/post/PostImageAttach.tsx", 1)
  assertMarkedNativeSurfaces("components/post/PostCard.tsx", 0)
  assertMarkedNativeSurfaces("components/post/PostVisibilityMenu.tsx", 1)
  assertMarkedNativeSurfaces("components/upload/UploadDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/photo/PhotoStats.tsx", 0)
  assertMarkedNativeSurfaces("components/photo/PhotoDetailDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/ImagePreviewModal.tsx", 0)
})

test("admin actions use Button and admin rows remain registered surfaces", () => {
  const taskFiles = [
    "components/admin/AdminHomepagePanel.tsx",
    "components/admin/AdminDashboardPanel.tsx",
    "components/admin/AdminForumModerationPanel.tsx",
    "components/admin/AdminReportsPanel.tsx",
    "components/admin/AdminContentModerationPanel.tsx",
    "components/admin/AdminTagManagementPanel.tsx",
    "components/admin/AdminAuditPanel.tsx",
    "components/admin/MediaPickerDialog.tsx",
    "components/admin/AdminMediaReviewPanel.tsx",
  ]

  for (const relativePath of taskFiles) {
    assertUsesShadcnButton(relativePath)
    for (const tag of openingTags(readSource(relativePath), "Spinner")) {
      assert.match(tag, /aria-label="加载中"/, `${relativePath}: ${tag}`)
    }
  }

  assertMarkedNativeSurfaces("components/admin/AdminHomepagePanel.tsx", 0)
  assertMarkedNativeSurfaces("components/admin/AdminDashboardPanel.tsx", 3)
  assertMarkedNativeSurfaces("components/admin/AdminForumModerationPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminReportsPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminContentModerationPanel.tsx", 3)
  assertMarkedNativeSurfaces("components/admin/AdminTagManagementPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminAuditPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/MediaPickerDialog.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminMediaReviewPanel.tsx", 0)

  const audit = readSource("components/admin/AdminAuditPanel.tsx")
  assert.match(
    audit,
    /if \(queueLoadLogsRef\.current\) return;\s+setLogs\(/,
    "queued audit refresh must discard an obsolete successful response before committing logs"
  )
  assert.match(
    audit,
    /catch \(error\) \{\s+if \(queueLoadLogsRef\.current\) return;\s+setListError\(/,
    "queued audit refresh must discard an obsolete failed response before committing the error"
  )
  assert.match(
    audit,
    /finally \{\s+loadLogsInFlightRef\.current = false;\s+if \(queueLoadLogsRef\.current\) \{\s+queueLoadLogsRef\.current = false;\s+setListRequestVersion\(\(current\) => current \+ 1\);\s+\} else \{\s+setListLoading\(false\);\s+\}\s+\}/,
    "queued audit refresh must keep loading active until the latest request finishes"
  )
  assert.match(
    audit,
    /if \(listLoading\) return;\s+if \(logs\.length === 0\)/,
    "audit selection reconciliation must wait for the final list"
  )
  assert.match(
    audit,
    /if \(!logs\.some\(\(log\) => log\.id === selectedId\)\) \{\s+onSelectedIdChange\(logs\[0\]\.id\);/,
    "audit selection reconciliation must keep only IDs present in the latest list"
  )

  assertBusyButtons(
    "components/admin/AdminAuditPanel.tsx",
    "onClick={() => void loadLogs()}",
    "listLoading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminContentModerationPanel.tsx",
    "onClick={() => void loadContent()}",
    "loading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminReportsPanel.tsx",
    "onClick={() => void loadReports()}",
    "listLoading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminTagManagementPanel.tsx",
    "onClick={() => void loadTags()}",
    "loading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminForumModerationPanel.tsx",
    'onClick={() => void loadPosts("reset")}',
    "loading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminDashboardPanel.tsx",
    "onClick={refreshAll}",
    "refreshBusy",
    1
  )

  for (const relativePath of [
    "components/admin/AdminAuditPanel.tsx",
    "components/admin/AdminContentModerationPanel.tsx",
    "components/admin/AdminReportsPanel.tsx",
    "components/admin/AdminTagManagementPanel.tsx",
    "components/admin/AdminForumModerationPanel.tsx",
    "components/admin/AdminDashboardPanel.tsx",
  ]) {
    const source = readSource(relativePath)
    assert.match(source, /const \w+InFlightRef = useRef\(false\);/, relativePath)
    assert.match(source, /if \(\w+InFlightRef\.current\)/, relativePath)
  }
  assertBusyButtons(
    "components/admin/AdminDashboardPanel.tsx",
    "onClick={() => void loadDashboard()}",
    "dashboardLoading",
    1
  )
  assertBusyButtons(
    "components/admin/AdminDashboardPanel.tsx",
    "onClick={() => void loadRecentLogs()}",
    "logsLoading",
    1
  )

  const homepage = readSource("components/admin/AdminHomepagePanel.tsx")
  const homepageButtons = elementBlocks(homepage, "Button")
  const removeFeatured = homepageButtons.find((block) => block.includes("移出精选"))
  assert.ok(removeFeatured)
  assert.match(homepage, /className="dark flex shrink-0 items-center gap-1"/)
  assert.match(openingTags(removeFeatured, "Button")[0], /variant="destructive"/)

  const forum = readSource("components/admin/AdminForumModerationPanel.tsx")
  const forumAction = elementBlocks(forum, "Button").find((block) =>
    block.includes("解锁帖子")
  )
  assert.ok(forumAction)
  assert.match(openingTags(forumAction, "Button")[0], /variant="outline"/)

  const reports = readSource("components/admin/AdminReportsPanel.tsx")
  const resolveReport = elementBlocks(reports, "Button").find((block) =>
    block.includes("提交处理结果")
  )
  assert.ok(resolveReport)
  assert.doesNotMatch(openingTags(resolveReport, "Button")[0], /variant=/)

  const content = readSource("components/admin/AdminContentModerationPanel.tsx")
  const moderateContent = elementBlocks(content, "Button").find((block) =>
    block.includes("恢复内容")
  )
  assert.ok(moderateContent)
  assert.match(
    openingTags(moderateContent, "Button")[0],
    /variant=\{selected\.status === "hidden" \? "outline" : "destructive"\}/
  )

  const tags = readSource("components/admin/AdminTagManagementPanel.tsx")
  const mergeTag = elementBlocks(tags, "Button").find((block) =>
    block.includes("确认合并")
  )
  assert.ok(mergeTag)
  assert.match(openingTags(mergeTag, "Button")[0], /variant="destructive"/)

  const mediaPicker = readSource("components/admin/MediaPickerDialog.tsx")
  const clearSearch = elementBlocks(mediaPicker, "Button").find((block) =>
    block.includes('aria-label="清空搜索"')
  )
  assert.ok(clearSearch)
  const clearSearchTag = openingTags(clearSearch, "Button")[0]
  assert.match(clearSearchTag, /variant="ghost"/)
  assert.match(clearSearchTag, /size="icon-sm"/)
  assert.match(clearSearchTag, /inset-y-0/)
  assert.match(clearSearchTag, /my-auto/)
  assert.doesNotMatch(clearSearchTag, /translate-y/)

  const mediaReview = readSource("components/admin/AdminMediaReviewPanel.tsx")
  assert.match(mediaReview, /type PendingReview = \{\s*id: string;\s*action: "approved" \| "rejected";\s*\};/)
  assert.match(mediaReview, /useState<PendingReview \| null>\(null\)/)
  assert.match(mediaReview, /const reviewInFlightRef = useRef\(false\);/)
  assert.match(mediaReview, /if \(reviewInFlightRef\.current\) return;/)
  const approve = elementBlocks(mediaReview, "Button").find((block) =>
    block.includes('handleReviewMedia(asset, "approved")')
  )
  const reject = elementBlocks(mediaReview, "Button").find((block) =>
    block.includes('handleReviewMedia(asset, "rejected")')
  )
  assert.ok(approve)
  assert.ok(reject)
  assert.match(openingTags(approve, "Button")[0], /disabled=\{pendingReview !== null\}/)
  assert.match(openingTags(approve, "Button")[0], /aria-busy=\{approving\}/)
  assert.match(approve, /\{approving \? \([\s\S]*<Spinner aria-label="加载中" \/>/)
  assert.doesNotMatch(openingTags(approve, "Button")[0], /variant=/)
  assert.match(openingTags(reject, "Button")[0], /disabled=\{pendingReview !== null\}/)
  assert.match(openingTags(reject, "Button")[0], /aria-busy=\{rejecting\}/)
  assert.match(reject, /\{rejecting \? \([\s\S]*<Spinner aria-label="加载中" \/>/)
  assert.match(openingTags(reject, "Button")[0], /variant="destructive"/)
})
