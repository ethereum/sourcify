# Restart session

Restarts the session by deleting all the provided input files and the resulting pending contracts.

**URL** : `/restart-session`

**Method** : `POST`

## Responses

**Condition** : Restart successful.

**Code** : `200 OK`

**Content** : 

```json
"Session successfully restarted"
```

### OR

**Condition** : Cannot restart the session.

**Code** : `500 Internal Server Error`

**Content** : 
```json
{
    "error": "Error in session restart"
}
```