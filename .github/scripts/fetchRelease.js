
async function main() {
    const fetchOpts = {
        headers: {},
    };

    if (process.env.GITHUB_TOKEN)
        fetchOpts.headers = { Authorization: `token ${process.env.GITHUB_TOKEN}` };

    const res = await fetch('https://api.github.com/repos/AztecProtocol/aztec-packages/releases', fetchOpts);

    const data = await res.json();

    const filtered = data.filter(
        release => release.tag_name.includes('aztec-packages'),
    );

    const latest = filtered[0].tag_name;

    // TODO: add the prerelease to this object!
    // const workflowOutput = JSON.stringify({ latest });
    console.log(latest); // DON'T REMOVE, GITHUB WILL CAPTURE THIS OUTPUT
}

main();