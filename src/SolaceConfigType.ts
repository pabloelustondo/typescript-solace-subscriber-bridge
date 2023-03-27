export type SolaceConfigType = {
    solace: {
        "url": string,
        "userName": string,
        "password": string,
        "vpnName": string

        topics: {
            [key:string]:string
        }
        queues: {
            [key:string]:string
        }
    } 
}
