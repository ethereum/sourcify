import { SERVER_URL } from "../common/constants";

type ResponseBody = {
    error?: string,
    errors?: [{ field: string, message: string }],
    result?: [{ address?: string, status?: string }]
}

type VerificationResult = {
    status: string,
    error: string,
    address: string
}

type CheckAddressesResult = {
    successful: string[],
    unsuccessful: string[],
    error: string
}

type CheckAddressesBody = [
    {
        address: string,
        status: string
    }
]

export const verify = async (formData: any): Promise<VerificationResult> => {
    const data: VerificationResult = {
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
        } else if (body.errors) {
            data.error = body.errors.map(e => e.message).join(", ");
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

export const checkAddresses = async (addresses: string, chainIds: string): Promise<CheckAddressesResult> => {
    const data: CheckAddressesResult = {
        successful: [],
        unsuccessful: [],
        error: ""
    }

    try {
        const response = await fetch(`${SERVER_URL}/checkByAddresses?addresses=${addresses}&chainIds=${chainIds}`, {
            method: "GET"
        })
        const body: CheckAddressesBody = await response.json();

        data.successful = body.filter(value => value.status === 'perfect').map(e => e.address);
        data.unsuccessful = body.filter(value => value.status === 'false').map(e => e.address);

    } catch (e) {
        console.log(e.message)
        data.error = e.message;
    }
    return data;
}