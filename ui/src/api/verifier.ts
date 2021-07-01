import { SERVER_URL } from "../common/constants";

type Status = "perfect" | "partial" | null;

type ResponseBody = {
    error?: string,
    errors?: { field: string, message: string }[],
    result?: { chain: string, address: string, status: Status }[]
}

type VerificationResult = {
    result: { chain: string, address: string, status: Status }[],
    error: string,
}

type CheckAddressesResult = {
    successful: ServersideAddressCheck[],
    unsuccessful: string[],
    error: string
}

export type ServersideAddressCheck = {
    address: string,
    status: string,
    chainIds?: string[]
};

export const verify = async (formData: any): Promise<VerificationResult> => {
    const data: VerificationResult = {
        result: [],
        error: ""
    };

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
            data.result = body.result;
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
        const body: ServersideAddressCheck[] = await response.json();

        data.successful = body.filter(value => value.status === 'perfect');
        data.unsuccessful = body.filter(value => value.status === 'false').map(e => e.address);

    } catch (e) {
        console.log(e.message)
        data.error = e.message;
    }
    return data;
}