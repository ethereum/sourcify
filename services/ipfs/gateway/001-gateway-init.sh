#!/bin/sh

echo "Initializing IPFS gateway with custom settings"

# Don't use the default subdomain gateway i.e. not <cid>.ipfs.localhost:8080 but localhost:8080/ipfs/<cid>
ipfs config --json Gateway.PublicGateways '{"localhost": null }'

# Add some content providers as peers for faster content discovery https://docs.ipfs.tech/how-to/peering-with-content-providers/#content-provider-list
# Markdown converted to JSON with ChatGPT
# web3.storage https://web3.storage/docs/reference/peering/
ipfs config --json Peering.Peers '[
 {
    "ID": "QmcFf2FH3CEgTNHeMRGhN7HNHU1EXAxoEk6EFuSyXCsvRE",
    "Addrs": [
      "/dnsaddr/node-1.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcFmLd5ySfk2WZuJ1mfSWLDjdmHZq7rSAua4GoeSQfs1z",
    "Addrs": [
      "/dnsaddr/node-2.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcfFmzSDVbwexQ9Au2pt5YEXHK5xajwgaU6PpkbLWerMa",
    "Addrs": [
      "/dnsaddr/node-3.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcfJeB3Js1FG7T8YaZATEiaHqNKVdQfybYYkbT1knUswx",
    "Addrs": [
      "/dnsaddr/node-4.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcfVvzK4tMdFmpJjEKDUoqRgP4W9FnmJoziYX5GXJJ8eZ",
    "Addrs": [
      "/dnsaddr/node-5.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcfZD3VKrUxyP9BbyUnZDpbqDnT7cQ4WjPP8TRLXaoE7G",
    "Addrs": [
      "/dnsaddr/node-6.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcfZP2LuW4jxviTeG8fi28qjnZScACb8PEgHAc17ZEri3",
    "Addrs": [
      "/dnsaddr/node-7.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcfgsJsMtx6qJb74akCw1M24X1zFwgGo11h1cuhwQjtJP",
    "Addrs": [
      "/dnsaddr/node-8.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "Qmcfr2FC7pFzJbTSDfYaSy1J8Uuy8ccGLeLyqJCKJvTHMi",
    "Addrs": [
      "/dnsaddr/node-9.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcfR3V5YAtHBzxVACWCzXTt26SyEkxdwhGJ6875A8BuWx",
    "Addrs": [
      "/dnsaddr/node-10.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "Qmcfuo1TM9uUiJp6dTbm915Rf1aTqm3a3dnmCdDQLHgvL5",
    "Addrs": [
      "/dnsaddr/node-11.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "QmcfV2sg9zaq7UUHVCGuSvT2M2rnLBAPsiE79vVyK3Cuev",
    "Addrs": [
      "/dnsaddr/node-12.ingress.cloudflare-ipfs.com"
    ]
  },
  {
    "ID": "12D3KooWGaHbxpDWn4JVYud899Wcpa4iHPa3AMYydfxQDb3MhDME",
    "Addrs": [
      "/dnsaddr/ipfs.ssi.eecc.de"
    ]
  },
  {
    "ID": "12D3KooWCVXs8P7iq6ao4XhfAmKWrEeuKFWCJgqe9jGDMTqHYBjw",
    "Addrs": [
      "/ip4/139.178.68.217/tcp/6744"
    ]
  },
  {
    "ID": "12D3KooWGBWx9gyUFTVQcKMTenQMSyE2ad9m7c9fpjS4NMjoDien",
    "Addrs": [
      "/ip4/147.75.49.71/tcp/6745"
    ]
  },
  {
    "ID": "12D3KooWFrnuj5o3tx4fGD2ZVJRyDqTdzGnU3XYXmBbWbc8Hs8Nd",
    "Addrs": [
      "/ip4/147.75.86.255/tcp/6745"
    ]
  },
  {
    "ID": "12D3KooWN8vAoGd6eurUSidcpLYguQiGZwt4eVgDvbgaS7kiGTup",
    "Addrs": [
      "/ip4/3.134.223.177/tcp/6745"
    ]
  },
  {
    "ID": "12D3KooWLV128pddyvoG6NBvoZw7sSrgpMTPtjnpu3mSmENqhtL7",
    "Addrs": [
      "/ip4/35.74.45.12/udp/6746/quic"
    ]
  },
  {
    "ID": "QmWaik1eJcGHq1ybTWe7sezRfqKNcDRNkeBaLnGwQJz1Cj",
    "Addrs": [
      "/dnsaddr/fra1-1.hostnodes.pinata.cloud"
    ]
  },
  {
    "ID": "QmNfpLrQQZr5Ns9FAJKpyzgnDL2GgC6xBug1yUZozKFgu4",
    "Addrs": [
      "/dnsaddr/fra1-2.hostnodes.pinata.cloud"
    ]
  },
  {
    "ID": "QmPo1ygpngghu5it8u4Mr3ym6SEU2Wp2wA66Z91Y1S1g29",
    "Addrs": [
      "/dnsaddr/fra1-3.hostnodes.pinata.cloud"
    ]
  },
  {
    "ID": "QmRjLSisUCHVpFa5ELVvX3qVPfdxajxWJEHs9kN3EcxAW6",
    "Addrs": [
      "/dnsaddr/nyc1-1.hostnodes.pinata.cloud"
    ]
  },
  {
    "ID": "QmPySsdmbczdZYBpbi2oq2WMJ8ErbfxtkG8Mo192UHkfGP",
    "Addrs": [
      "/dnsaddr/nyc1-2.hostnodes.pinata.cloud"
    ]
  },
  {
    "ID": "QmSarArpxemsPESa6FNkmuu9iSE1QWqPX2R3Aw6f5jq4D5",
    "Addrs": [
      "/dnsaddr/nyc1-3.hostnodes.pinata.cloud"
    ]
  },
  {
    "ID": "12D3KooWFFhc8fPYnQXdWBCowxSV21EFYin3rU27p3NVgSMjN41k",
    "Addrs": [
      "/ip4/5.161.92.43/tcp/4001"
    ]
  },
  {
    "ID": "12D3KooWSW4hoHmDXmY5rW7nCi9XmGTy3foFt72u86jNP53LTNBJ",
    "Addrs": [
      "/ip4/5.161.55.227/tcp/4001"
    ]
  },
  {
    "ID": "12D3KooWSDj6JM2JmoHwE9AUUwqAFUEg9ndd3pMA8aF2bkYckZfo",
    "Addrs": [
      "/ip4/5.161.92.36/tcp/4001"
    ]
  },
  {
    "ID": "QmR69wtWUMm1TWnmuD4JqC1TWLZcc8iR2KrTenfZZbiztd",
    "Addrs": [
      "/ip4/104.210.43.77"
    ]
  },
  {
    "ID": "12D3KooWGASC2jm3pmohEJXUhuStkxDitPgzvs4qMuFPaiD9x1BA",
    "Addrs": [
      "/ip4/78.46.108.24"
    ]
  },
  {
    "ID": "12D3KooWRbWZN3GvLf9CHmozq4vnTzDD4EEoiqtRJxg5FV6Gfjmm",
    "Addrs": [
      "/ip4/65.109.19.136"
    ]
  },
  {
    "ID": "12D3KooWQ85aSCFwFkByr5e3pUCQeuheVhobVxGSSs1DrRQHGv1t",
    "Addrs": [
      "/dnsaddr/node-1.ipfs.4everland.net"
    ]
  }
]'