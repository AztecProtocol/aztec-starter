async function main() {
    const headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'aztec-starter-ci'
    };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const url = 'https://api.github.com/repos/AztecProtocol/aztec-packages/releases?per_page=100';
    const res = await fetch(url, { headers });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`GitHub API error ${res.status} ${res.statusText}: ${body}`);
        process.exit(1);
    }

    let data;
    try {
        data = await res.json();
    } catch (err) {
        console.error('Failed to parse GitHub API response as JSON', err);
        process.exit(1);
    }

    if (!Array.isArray(data)) {
        console.error(`Unexpected GitHub API response (expected array): ${JSON.stringify(data, null, 2)}`);
        process.exit(1);
    }

    const release = data.find(r => !r.draft && !/nightly/i.test(r.tag_name) && !/staging/i.test(r.tag_name));
    if (!release) {
        console.error('No suitable release found');
        process.exit(1);
    }

    console.log(release.tag_name); // GitHub captures this output
}

main();
