async function main() {
    const fetchOpts = { headers: {} };
    if (process.env.GITHUB_TOKEN) {
        fetchOpts.headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch('https://api.github.com/repos/AztecProtocol/aztec-packages/releases', fetchOpts);
    const data = await res.json();

    const release = data.find(r => !r.draft && !/nightly/i.test(r.tag_name) && !/staging/i.test(r.tag_name));
    if (!release) {
        console.error('No suitable release found');
        process.exit(1);
    }

    console.log(release.tag_name); // GitHub captures this output
}

main();
