import { Octokit } from "octokit";

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: token });
}

function getRepoInfo() {
  return {
    owner: process.env.GITHUB_REPO_OWNER || "",
    repo: process.env.GITHUB_REPO_NAME || "myfence-clone",
    defaultBranch: process.env.GITHUB_DEFAULT_BRANCH || "main",
  };
}

interface PublishBlogParams {
  slug: string;
  mdxContent: string;
  title: string;
  commitMessage?: string;
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
}: PublishBlogParams): Promise<{ prUrl: string; prNumber: number }> {
  const octokit = getOctokit();
  const { owner, repo, defaultBranch } = getRepoInfo();

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
    body: `## Auto-published from MyFence Studio\n\n**Post:** ${title}\n**Slug:** \`/blog/${slug}\`\n**File:** \`${filePath}\`\n\n---\n*This PR was created automatically by the MyFence Studio CMS.*`,
    head: branchName,
    base: defaultBranch,
  });

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
  };
}
