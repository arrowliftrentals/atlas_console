import { atlasChat } from "@/lib/atlasClient";
import type { AtlasChatRequest, AtlasChatResponse } from "@/lib/types";

export async function fetchProjectFileList(
  project: string,
  subpath: string
): Promise<string[]> {
  // Normalize path to ensure proper format
  const normalizedPath =
    !subpath || subpath === '.' ? '.' : subpath.startsWith('./') ? subpath : `./${subpath}`;

  const query = `list files in project ${project} ${normalizedPath}`;

  const payload: AtlasChatRequest = {
    query,
    assumptions: [],
    context: null,
    override_unresolved_assumptions: true,
  };

  const resp: AtlasChatResponse = await atlasChat(payload);

  if (!resp || typeof resp.answer !== "string") {
    console.warn('fetchProjectFileList: invalid response', { project, subpath, query, resp });
    throw new Error("Invalid response from ATLAS Core (missing answer).");
  }

  const answer = resp.answer.trim();

  const files = answer
    .split("\n")
    .map((ln) => ln.trim())
    .filter(
      (ln) =>
        ln.length > 0 &&
        !ln.toLowerCase().startsWith("listing files") &&
        !ln.toLowerCase().startsWith("error:")
    );

  if (files.length === 0) {
    console.warn('fetchProjectFileList: no files returned', { project, subpath, query, answer });
  }

  return files;
}

export async function fetchProjectFileContent(
  project: string,
  relativePath: string
): Promise<string> {
  const query = `read file project ${project} ${relativePath}`;

  const payload: AtlasChatRequest = {
    query,
    assumptions: [],
    context: null,
    override_unresolved_assumptions: true,
  };

  const resp: AtlasChatResponse = await atlasChat(payload);

  if (!resp || typeof resp.answer !== "string") {
    throw new Error("Invalid response from ATLAS Core (missing answer).");
  }

  return resp.answer;
}

export async function writeProjectFile(
  project: string,
  relativePath: string,
  content: string
): Promise<string> {
  const query = `write file project ${project} ${relativePath}`;

  const payload: AtlasChatRequest = {
    query,
    assumptions: [],
    context: content,
    override_unresolved_assumptions: true,
  };

  const resp: AtlasChatResponse = await atlasChat(payload);

  if (!resp || typeof resp.answer !== "string") {
    throw new Error("Invalid response from ATLAS Core (missing answer).");
  }

  return resp.answer;
}
