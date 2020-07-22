import {SERVER_URL} from "../common/constants";

type ResponseBody =  {
    error?: string,
    result?: [
        {address?: string, status?: string}
    ]
}

type VerificationResult = {
    status: string,
    error: string,
    address: string
}

export const verify = async (formData: any): Promise<VerificationResult> => {
    const data:VerificationResult = {
        status: "",
        error: "",
        address: ""
    }

    try {
        const response = await fetch(SERVER_URL, {
            method: "POST",
            body: formData
        })
        const body: ResponseBody = await response.json();

        if (body.error) {
            data.error = body.error;
        } else {
            data.address = body.result[0].address;
            data.status = body.result[0].status;
        }

    } catch (e) {
        console.log(e);
        data.error = e.message;
    }
    return data;
}