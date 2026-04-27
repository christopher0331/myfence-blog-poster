import { Octokit } from "octokit";
import type { SiteConfig } from "@/lib/types";

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: token });
}

function getRepoInfo(site?: SiteConfig) {
  const info = {
    owner: site?.github_repo_owner || process.env.GITHUB_REPO_OWNER || "",
    repo: site?.github_repo_name || process.env.GITHUB_REPO_NAME || "myfence-clone",
    defaultBranch:
      site?.github_default_branch || process.env.GITHUB_DEFAULT_BRANCH || "main",
  };
  if (!info.owner) {
    throw new Error(
      `GitHub repo owner is not configured for ${site?.name || site?.domain || "this site"}`,
    );
  }
  if (!info.repo) {
    throw new Error(
      `GitHub repo name is not configured for ${site?.name || site?.domain || "this site"}`,
    );
  }
  return info;
}

interface PublishBlogParams {
  slug: string;
  mdxContent: string;
  title: string;
  commitMessage?: string;
  site?: SiteConfig;
}

/**
 * Creates a new branch, commits an MDX blog file, and opens a PR
 * against the main myfence repo.
 */
export async function createBlogPR({
  slug,
  mdxContent,
  title,
  commitMessage,
  site,
}: PublishBlogParams): Promise<{ prUrl: string; prNumber: number }> {
  const octokit = getOctokit();
  const { owner, repo, defaultBranch } = getRepoInfo(site);

  // 1. Get the SHA of the default branch HEAD
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const baseSha = refData.object.sha;

  // 2. Create a new branch
  const branchName = `blog/${slug}`;
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  // 3. Create (or update) the MDX file in the new branch
  const filePath = `src/content/blog/${slug}.mdx`;
  const message = commitMessage || `Add blog post: ${title}`;

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: Buffer.from(mdxContent).toString("base64"),
    branch: branchName,
  });

  // 4. Open a PR
  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `📝 New Blog: ${title}`,
    body: `## Auto-published from ${site?.name || "Studio CMS"}\n\n**Post:** ${title}\n**Slug:** \`/blog/${slug}\`\n**File:** \`${filePath}\`\n\n---\n*This PR was created automatically by the ${site?.name || "Studio CMS"} CMS.*`,
    head: branchName,
    base: defaultBranch,
  });

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
  };
}

/**
 * Commits an MDX blog file directly to the main branch (no PR)
 */
export async function commitBlogDirectly({
  slug,
  mdxContent,
  title,
  commitMessage,
  site,
}: PublishBlogParams): Promise<{ commitUrl: string; sha: string }> {
  const octokit = getOctokit();
  const { owner, repo, defaultBranch } = getRepoInfo(site);
  console.log(`[GitHub] Publishing ${slug}.mdx to ${owner}/${repo}@${defaultBranch}`);

  const filePath = `src/content/blog/${slug}.mdx`;
  const message = commitMessage || `Add blog post: ${title}`;

  // Get the current SHA of the file (if it exists)
  let currentSha: string | undefined;
  try {
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: defaultBranch,
    });
    if (Array.isArray(fileData)) {
      throw new Error("Path is a directory, not a file");
    }
    currentSha = fileData.sha;
  } catch (error: any) {
    // File doesn't exist yet, that's fine
    if (error.status !== 404) {
      throw error;
    }
  }

  // Commit directly to main branch
  const { data: commit } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: Buffer.from(mdxContent).toString("base64"),
    branch: defaultBranch,
    sha: currentSha, // If file exists, update it; otherwise create new
  });

  if (!commit.commit?.sha) {
    throw new Error("Failed to get commit SHA from GitHub response");
  }

  const commitSha = commit.commit.sha;
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${commitSha}`;

  return {
    commitUrl,
    sha: commitSha,
  };
}