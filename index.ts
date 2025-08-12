import { parseSetCookie } from "cookie-es";
import type { Root } from "hast";
import assert from "node:assert";
import { inspect } from "node:util";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { read } from "to-vfile";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const response = await fetch("https://academy.jahia.com/cms/login?restMode=true", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    username: "gbenaim@jahia.com",
    password: process.env.PASSWORD!,
    useCookie: "on",
  }),
});

assert.ok(response.ok);

const text = await response.text();

assert.equal(text, "OK");

const cookies = response.headers.getSetCookie().map((str) => parseSetCookie(str));

const jcrPath =
  "/sites/academy/home/get-started/front-end-developer/setting-up-your-dev-environment/document-area/setting-up-your-dev-environment";
const mdPath = "./docs/1-getting-started/1-dev-environment/README.md";
const parent =
  "https://github.com/GauBen/javascript-modules/raw/main/docs/1-getting-started/1-dev-environment/";

const file = await unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(() => (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "img") {
        // Replace relative images with absolute URLs
        const src = node.properties.src;
        if (typeof src === "string" && !src.startsWith("http")) {
          node.properties.src = new URL(src, parent).href;
        }
      } else if (node.tagName === "code") {
        // Trim code nodes
        if (node.children.length === 1 && node.children[0].type === "text") {
          node.children[0].value = node.children[0].value.trim();
        }
      }
    });
  })
  .use(rehypeStringify)
  .process(await read(mdPath));

const html = String(file);
console.log(html);

const response2 = await fetch("https://academy.jahia.com/modules/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Cookie": cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    "Referer": "https://academy.jahia.com",
  },
  body: JSON.stringify({
    query: /* GraphQL */ `
      mutation ($path: String!, $value: String!) {
        edit: jcr(workspace: EDIT) {
          mutateNode(pathOrId: $path) {
            mutateProperty(name: "textContent") {
              setValue(value: $value, language: "en")
            }
          }
        }
        # publish: jcr(workspace: EDIT) {
        #   mutateNode(pathOrId: $path) {
        #     publish(languages: ["en"])
        #   }
        # }
      }
    `,
    variables: {
      path: jcrPath,
      value: html,
    },
  }),
});

console.log(inspect(await response2.json(), { depth: Infinity, colors: true }));
