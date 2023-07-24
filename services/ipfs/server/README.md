When testing use the following docker run command to prevent reimporting the repository each time. Note that the first time is mandatory.

Setting `--env DEBUG=true` will:

- prevent adding all the repo to ipfs (using the existing one, set with `-v /path_to_local_ipfs_folder:/root/.ipfs`)
- prevent using the private keys
- prevent running cron
- prevent using remote pinning services

```
docker run  -it --rm --name sourcify_ipfs --env DEBUG=true  -v /path_to_local_sourcify_repo:/repository/ -v /path_to_local_ipfs_folder:/root/.ipfs  -p 5001:5001 -p 8080:8080 -p 4001:4001 ipfs_sourcify
```
