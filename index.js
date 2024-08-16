const axios = require('axios');
const express = require('express');
const cors = require('cors');
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: 'apify_api_FHXJTtwdN7pCk3TQnpZ1ixg5NbQxNi3gJ0vr',
});

const app = express();
const port = 3000;

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(cors());

const apiToken = '8677881983msh4c3ca83176a596bp1f2fa7jsnc393d8affa02';
// https://rapidapi.com/ptwebsolution/api/tokopedia7
// https://rapidapi.com/tmapi-tmapi-default/api/lazada-api

async function extract_information(text) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI("AIzaSyBZUa3XM7P0exH2uReX-08Ax7dgYKBmgto");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Ekstraksi informasi dari teks berikut sesuai dengan ketentuan: setiap jawaban pertanyaan akan dipisahkan dengan enter. Berikut adalah teksnya: ${text}. Berikut adalah 3 pertanyaan yang harus dijawab, dengan ketentuan dalam tanda kurung setiap pertanyaan:
    1. Barang apa yang ingin dibeli / dicari? (Jawablah dengan tanpa ada singkatan beserta spesifikasinya, jika ada singkatan maka ubahlah menjadi kata penuhnya, misal HP menjadi handphone)
    2. Berapa harga minimal atau termurah? (Jawablah hanya dengan angka tanpa tanda ataupun satuan, jika ada satuan dalam kata ubahlah menjadi angka yang merepresentasikan satuan tersebut, jika tidak ada data pada teks, berikan 0)
    3. Berapa harga maksimal atau termahal? (Jawablah hanya dengan angka tanpa tanda ataupun satuan, jika ada satuan dalam kata ubahlah menjadi angka yang merepresentasikan satuan tersebut, jika tidak ada data pada teks, berikan 999999999)`;
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const data = {
        product: response.split("\n")[0],
        min_price: parseInt(response.split("\n")[1]),
        max_price: parseInt(response.split("\n")[2])
    };
    return data;
}

app.get('/barang', async (req, res) => {
    const { product, min_price, max_price } = await extract_information(req.query.q);

    console.log({
        product: product,
        min_price: min_price,
        max_price: max_price
    });

    const tokopedia_options = {
        method: 'GET',
        url: 'https://tokopedia7.p.rapidapi.com/product/search',
        params: {
            q: product,
            page: '1',
            ob: '10'
        },
        headers: {
            'x-rapidapi-key': apiToken,
            'x-rapidapi-host': 'tokopedia7.p.rapidapi.com'
        }
    };
    const lazada_options = {
        method: 'GET',
        url: 'https://lazada-api.p.rapidapi.com/lazada/search/items',
        params: {
            keywords: product,
            site: 'id',
            page: '1',
            sort: 'pop'
        },
        headers: {
            'x-rapidapi-key': apiToken,
            'x-rapidapi-host': 'lazada-api.p.rapidapi.com'
        }
    };

    try {
        let response = await axios.request(tokopedia_options);
        const data_tokopedia = response.data;
        response = await axios.request(lazada_options);
        const data_lazada = response.data;

        const tokopedia_products = [];
        data_tokopedia.results.data.products.forEach((p) => {
            tokopedia_products.push({
                image: p.imageUrl,
                name: p.name,
                shop: "Tokopedia",
                price: p.price.replace("Rp", "").replace(/\./g, ""),
                link: p.url
            });
        });

        const lazada_products = [];
        data_lazada.data.items.forEach((p) => {
            lazada_products.push({
                image: p.img,
                name: p.title,
                shop: "Lazada",
                price: p.price,
                link: p.product_url
            });
        });

        return res.status(200).json([
                ...tokopedia_products,
                ...lazada_products
            ]
            .sort((p1, p2) => p1.price - p2.price)
            .filter((p) => p.price >= min_price && p.price <= max_price)
        );
    } catch (error) {
        console.error(error);
        return res.status(500).json(error.message);
    }
});

app.get('/tokopedia', async (req, res) => {
    // jupri/tokopedia-scraper
    const input = {
        "dev_dataset_clear": false,
        "dev_dataset_enable": false,
        "dev_no_strip": false,
        "dev_transform_enable": false,
        "limit": 5,
        "query": req.query.q,
        "sort": "relevance"
    };

    const run = await client.actor("S337CFUaMdypqcQkH").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });

    return res.status(200).json(
        items.sort(
            (a, b) =>
                parseInt(a.price.value.split("Rp")[1]) -
                parseInt(b.price.value.split("Rp")[1])
        )
    );
});

app.get('/lazada', async (req, res) => {
    // jupri/lazada
    const input = {
        "dev_dataset_clear": false,
        "dev_dataset_enable": false,
        "dev_no_strip": false,
        "dev_transform_enable": false,
        "limit": 5,
        "portal": "id",
        "query": req.query.q,
        "sort": "popular"
    };

    const run = await client.actor("hiE0fjLx2r99kkyXc").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });

    return res.status(200).json(
        items.sort(
            (a, b) =>
                parseInt(a.priceShow.split("Rp")[1]) -
                parseInt(b.priceShow.split("Rp")[1])
        )
    );
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));