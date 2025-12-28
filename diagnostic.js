
const fetch = require('node-fetch'); // Assuming node-fetch is available or using global fetch in newer node

const CONTRACT_ID = 'SP2A8V93XXB43Q8JXQNCS9EBFHZJ6A2HVXHC4F4ZB.tip-jar';
const [contractAddress, contractName] = CONTRACT_ID.split('.');

async function run() {
    try {
        const base = 'https://api.hiro.so';
        const addr = `${contractAddress}.${contractName}`;
        console.log(`Checking address: ${addr}`);

        const txUrl = `${base}/extended/v1/address/${addr}/transactions?limit=50`;
        const mempoolUrl = `${base}/extended/v1/address/${addr}/mempool?limit=50`;

        console.log(`Fetching ${txUrl}...`);
        const txRes = await fetch(txUrl);
        const txData = await txRes.json();
        console.log(`Transactions status: ${txRes.status}`);

        console.log(`Fetching ${mempoolUrl}...`);
        const mempoolRes = await fetch(mempoolUrl);
        const mempoolData = await mempoolRes.json();
        console.log(`Mempool status: ${mempoolRes.status}`);

        const allTxs = [...(mempoolData.results || []), ...(txData.results || [])];
        console.log(`Total transactions fetched: ${allTxs.length}`);

        const tips = allTxs.filter(
            (tx) =>
                tx.tx_type === 'contract_call' &&
                (tx.tx_status === 'success' || tx.tx_status === 'pending' || tx.tx_status === 'abort_by_response') &&
                tx.contract_call && tx.contract_call.function_name === 'tip'
        );

        console.log(`Filtered tips count: ${tips.length}`);

        if (tips.length > 0) {
            console.log('First 3 tips:');
            console.log(JSON.stringify(tips.slice(0, 3), null, 2));
        } else {
            console.log('No tips found matching filter.');
            if (allTxs.length > 0) {
                console.log('Sample transaction (to check why filter failed):');
                console.log(JSON.stringify(allTxs[0], null, 2));
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
