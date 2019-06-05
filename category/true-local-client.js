"use strict";
const axios = require("axios");
const _ = require('lodash');

async function search(value, location) {
    console.log("Searching on TrueLocal for merchant " + value + "...");
    try {
        const response = await axios.get("https://api.truelocal.com.au/rest/listings", {
            params: {
                "keyword": value,
                "limit": "1",
                "offset": "0",
                "type": "keyword",
                "location": "australia",
                "passToken": "V0MxbDBlV2VNUw=="
            }
        });

        let payload;
        if (response && response.data) {
            payload = response.data;
        }

        if (payload && payload.data && payload.data.facets) {
            const facet = _.find(payload.data.facets, { "type": "categories_facet" });
            if (facet.count) {
                let categoryCode = Object.keys(facet.count)[0];
                categoryCode = categoryCode.replace(/[^a-zA-Z0-9]/g, '');
                console.log("Category found for " + value + " is: " + categoryCode);

                return { category: categoryCode };
            }
        }
        console.log("Search in TrueLocal complete.");
    } catch (error) {
        console.log(error);
    }
};

module.exports = {
    search
};