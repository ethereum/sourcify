# Add new input files

- Adds new input files and immediately scans through them, searching for new contracts.
- Every contract is represented by its metadata file, a special file generated during the original compilation.
- If possible, runs the process of verification, as described in [Verify](verify-validated.md).

**URL** : `/input-files`

**Method** : `POST`

**Content-Type** : `multipart/form-data` or `application/json`

If using `multipart/form-data`, the files should be in a field named `files`.
If using `application/json`, the files should be in an object under the key `files` so the whole object is of the form:
```json
{
    "files": {
        "file-name1.sol": ...,
        "file-name2.sol": ...
    }
}
```

## Responses

**Conditions** :
* Session is empty prior to the upload.
* Uploading one metadata file.

**Code** : `200 OK`

**Content** : 

```json
{
    "contracts": [
        {
            "compiledPath": "browser/1_Storage.sol",
            "name": "Storage",
            "compilerVersion": "0.6.6+commit.6c089d02",
            "files": {
                "found": [],
                "missing": [
                    "browser/1_Storage.sol"
                ]
            },
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
            "status": "error"
        }
    ],
    "unused": []
}
```
### OR

**Conditions** :
* Session only contains a metadata file that specifies one source file that is not yet uploaded.
* The address and chainId are NOT specified, so the verification cannot be run after just uploading the missing source file.
* Uploading the missing source file.

**Code** : `200 OK`

**Content** : 

```json
{
    "contracts": [
        {
            "compiledPath": "browser/1_Storage.sol",
            "name": "Storage",
            "compilerVersion": "0.6.6+commit.6c089d02",
            "files": {
                "found": [
                    "browser/1_Storage.sol"
                ],
                "missing": []
            },
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
            "status": "error"
        }
    ],
    "unused": []
}
```

### OR

**Conditions** :
* Session only contains a metadata file that specifies one source file that is not yet uploaded.
* The address and chainId have alredy been specified, so the verification is run automatically after uploading the missing source file.
* Uploading the missing source file.

**Code** : `200 OK`

**Content** : 

```json
{
    "contracts": [
        {
            "address": "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
            "chainId": "100",
            "compiledPath": "browser/1_Storage.sol",
            "name": "Storage",
            "compilerVersion": "0.6.6+commit.6c089d02",
            "files": {
                "found": [
                    "browser/1_Storage.sol"
                ],
                "missing": []
            },
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
            "status": "perfect" | "partial" | "error" // the conditions for each outcome are described in the `status` section of exchange-object.md
        }
    ],
    "unused": []
}
```

### OR

**Conditions** :
* Session is empty prior to the upload.
* Uploading only a source file called `"1_Storage.sol"`.

**Code** : `200 OK`

**Content** :
```json
{
    "contracts": [],
    "unused": ["1_Storage.sol"]
}
```

### OR

**Conditions** :
* Session already takes up a lot of memory, cannot hold a single new input file.
* Uploading a new input file.

**Code** : `413 Payload Too Large`

**Content** :
```json
{
    "error": "Too much session memory used. Delete some files or restart the session."
}
```