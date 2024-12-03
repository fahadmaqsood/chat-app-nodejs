
import axios from 'axios';

export const bingWebSearch = async (query, page = 1) => {
    // console.log("offset", `${15 * (page - 1)}`);
    const endpoint = 'https://api.bing.microsoft.com/v7.0/search';
    const headers = {
        'Ocp-Apim-Subscription-Key': process.env.BING_SUBSCRIPTION_KEY
    };
    const params = {
        q: query,
        // mkt: user_location,
        SafeSearch: "strict",
        count: "15",
        offset: `${15 * (page - 1)}`,
    };

    try {
        const response = await axios.get(endpoint, { headers, params });

        // // Log relevant headers starting with 'bingapis-' or 'x-msedge-'
        // for (const header in response.headers) {
        //     if (header.startsWith('bingapis-') || header.startsWith('x-msedge-')) {
        //         console.log(`${header}: ${response.headers[header]}`);
        //     }
        // }

        return response.data;

        // // Log the JSON response
        // console.log('\nJSON Response:\n');
        // // console.dir(response.data, { colors: false, depth: null });


        // console.log(Object.keys(response.data));


        // let images = [];


        // var searchResponse = response.data;

        // // console.log(getWebPages(searchResponse));
        // // console.log(getImages(searchResponse));
        // console.log(getVideos(searchResponse));


    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}


export function getWebPages(searchResponse) {
    let webpages = [];

    for (var i = 0; i < searchResponse.webPages.value.length; ++i) {

        var webPage = searchResponse.webPages.value[i];

        // console.log(Object.keys(webPage));

        let _webpage = {};
        _webpage.title = webPage.name;
        _webpage.url = webPage.url;
        // _webpage.contentUrl = webPage.contentUrl;
        // _webpage.displayUrl = webPage.displayUrl;
        // _webpage.thumbnailUrl = webPage.thumbnailUrl;
        _webpage.description = webPage.snippet;
        _webpage.datePublished = webPage.datePublished;

        if (!webPage.primaryImageOfPage) {
            continue;
        }

        _webpage.image_url = webPage.primaryImageOfPage.thumbnailUrl.replace("&w=" + webPage.primaryImageOfPage.width, "&w=" + webPage.primaryImageOfPage.sourceWidth).replace("&h=" + webPage.primaryImageOfPage.height, "&h=" + webPage.primaryImageOfPage.sourceHeight) + "&p=0";
        _webpage.source = webPage.siteName;

        _webpage.type = "webpage";

        webpages.push(_webpage);
    }

    return webpages;
}


export function getImages(searchResponse) {
    let webpages = [];

    for (var i = 0; i < searchResponse.images.value.length; ++i) {

        var webPage = searchResponse.images.value[i];

        // console.log(Object.keys(webPage));

        let _webpage = {};
        _webpage.title = webPage.name;
        _webpage.url = webPage.hostPageUrl;
        _webpage.image_url = webPage.thumbnailUrl;
        _webpage.datePublished = webPage.datePublished;
        // _webpage.thumbnail = webPage.thumbnail;

        _webpage.type = "image";

        webpages.push(_webpage);
    }

    return webpages;
}


export function getVideos(searchResponse) {
    let webpages = [];

    for (var i = 0; i < searchResponse.videos.value.length; ++i) {

        var webPage = searchResponse.videos.value[i];

        // console.log(Object.keys(webPage));

        let _webpage = {};
        _webpage.title = webPage.name;
        _webpage.url = webPage.hostPageUrl;
        _webpage.image_url = webPage.thumbnailUrl;
        _webpage.datePublished = webPage.datePublished;
        // _webpage.thumbnail = webPage.thumbnail;
        _webpage.description = webPage.description;
        _webpage.creator = webPage.creator.name;


        _webpage.type = "video";


        webpages.push(_webpage);
    }

    return webpages;
}