const axios = require("axios");
const utils = require("./utils");

const units = {
    piece: { unit: "kus", factor: 1 }, // 13820x
    kg: { unit: "kilogram", factor: 1 }, // 302x
};

exports.getCanonical = function (item, today) {
    let quantity = item.productProposedPackaging;
    let bio = item.badges;
    for (let x of bio) {
        if (x.code == "badgeattributebio") {
            bio = true;
            break;
        }
    }
    return utils.convertUnit(
        {
            id: "" + item.code,
            name: item.name,
            // description: "", not available
            price: item.price.value,
            priceHistory: [{ date: today, price: item.price.value }],
            unit: item.price.unit,
            quantity,
            url: item.url,
            categoryNames: item.categoryNames,
            ...(bio === true && { bio: true }),
        },
        units,
        "albert"
    );
};

async function sha256(message) {
    // encode as UTF-8
    const msgBuffer = new TextEncoder().encode(message);

    // hash the message
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

    // convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // convert bytes to hex string
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
}

exports.fetchData = async function () {
    const body = { query: "query DeviceId {deviceId}" };
    let axiosConfiguration = {
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
            "X-Apollo-Operation-Name": "DeviceId",
        },
    };

    console.log(`Albert https://www.albert.cz/api/v1/ ${JSON.stringify(body)} ${JSON.stringify(axiosConfiguration)}`);
    const deviceId = await axios
        .post("https://www.albert.cz/api/v1/", body, axiosConfiguration)
        .then((res) => {
            return res.data.data.deviceId;
        })
        .catch((err) => {
            console.log("Albert error: ", err);
        });

    let albertItems = [];
    if (!deviceId) return albertItems;

    let sha256Hash = await sha256(
        "query LeftHandNavigationBar($rootCategoryCode: String, $cutOffLevel: String, $lang: String, $topLevelCategoriesToHideIfEmpty: String, $anonymousCartCookie: String) {\n  leftHandNavigationBar(\n    rootCategoryCode: $rootCategoryCode\n    cutOffLevel: $cutOffLevel\n    lang: $lang\n    topLevelCategoriesToHideIfEmpty: $topLevelCategoriesToHideIfEmpty\n    anonymousCartCookie: $anonymousCartCookie\n  ) {\n    categoryTreeList {\n      categoriesInfo {\n        categoryCode\n        levelInfo {\n          ...CategoryFields\n          __typename\n        }\n        __typename\n      }\n      level\n      __typename\n    }\n    levelInfo {\n      ...CategoryFields\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment CategoryFields on CategoryLevelInfo {\n  name\n  productCount\n  url\n  code\n  __typename\n}"
    ); // sha256Hash = '29a05b50daa7ab7686d28bf2340457e2a31e1a9e4d79db611fcee435536ee01c';

    const ALBERT_BASE_URL = "https://www.albert.cz/api/v1/?operationName=";
    const CATEGORY_CODES =
        'LeftHandNavigationBar&variables={"rootCategoryCode":"","cutOffLevel":"4","lang":"cs"}&extensions={"persistedQuery":{"version":1,"sha256Hash":"' +
        sha256Hash +
        '"}}';

    console.log(`Albert ${ALBERT_BASE_URL + CATEGORY_CODES} ${JSON.stringify(axiosConfiguration)}`);
    let categories = await fetch(ALBERT_BASE_URL + CATEGORY_CODES, axiosConfiguration);
    if (categories.status == 200) {
        categories = await categories.json();
    } else return albertItems;
    if (!categories || !categories?.data?.leftHandNavigationBar?.levelInfo?.length) return albertItems;

    const blockOfPages = 40; // original 20 / max. 50
    sha256Hash = await sha256(
        "query GetCategoryProductSearch($lang: String, $searchQuery: String, $pageSize: Int, $pageNumber: Int, $category: String, $sort: String, $filterFlag: Boolean, $plainChildCategories: Boolean, $facetsOnly: Boolean) {\n  categoryProductSearch: categoryProductSearchV2(\n    lang: $lang\n    searchQuery: $searchQuery\n    pageSize: $pageSize\n    pageNumber: $pageNumber\n    category: $category\n    sort: $sort\n    filterFlag: $filterFlag\n    plainChildCategories: $plainChildCategories\n    facetsOnly: $facetsOnly\n  ) {\n    products {\n      ...ProductBlockDetails\n      __typename\n    }\n    breadcrumbs {\n      ...Breadcrumbs\n      __typename\n    }\n    categoryBreadcrumbs {\n      ...CategoryBreadcrumbs\n      __typename\n    }\n    facets {\n      ...Facets\n      __typename\n    }\n    sorts {\n      name\n      selected\n      code\n      __typename\n    }\n    pagination {\n      ...Pagination\n      __typename\n    }\n    currentQuery {\n      query {\n        value\n        __typename\n      }\n      url\n      __typename\n    }\n    categorySearchTree {\n      categoryDataList {\n        categoryCode\n        categoryData {\n          facetData {\n            count\n            name\n            nameNonLocalized\n            query {\n              query {\n                value\n                __typename\n              }\n              url\n              __typename\n            }\n            selected\n            thumbnailUrl\n            __typename\n          }\n          subCategories\n          __typename\n        }\n        __typename\n      }\n      level\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment ProductBlockDetails on Product {\n  available\n  averageRating\n  numberOfReviews\n  manufacturerName\n  manufacturerSubBrandName\n  code\n  badges {\n    ...ProductBadge\n    __typename\n  }\n  badgeBrand {\n    ...ProductBadge\n    __typename\n  }\n  promoBadges {\n    ...ProductBadge\n    __typename\n  }\n  delivered\n  littleLion\n  freshnessDuration\n  freshnessDurationTipFormatted\n  frozen\n  recyclable\n  images {\n    format\n    imageType\n    url\n    __typename\n  }\n  isBundle\n  isProductWithOnlineExclusivePromo\n  maxOrderQuantity\n  limitedAssortment\n  mobileFees {\n    ...MobileFee\n    __typename\n  }\n  name\n  onlineExclusive\n  potentialPromotions {\n    isMassFlashOffer\n    endDate\n    alternativePromotionMessage\n    alternativePromotionBadge\n    code\n    priceToBurn\n    promotionType\n    pickAndMix\n    qualifyingCount\n    freeCount\n    range\n    redemptionLevel\n    toDisplay\n    description\n    title\n    promoBooster\n    simplePromotionMessage\n    offerType\n    restrictionType\n    priority\n    percentageDiscount\n    __typename\n  }\n  price {\n    approximatePriceSymbol\n    currencySymbol\n    formattedValue\n    priceType\n    supplementaryPriceLabel1\n    supplementaryPriceLabel2\n    showStrikethroughPrice\n    discountedPriceFormatted\n    discountedUnitPriceFormatted\n    unit\n    unitPriceFormatted\n    unitCode\n    unitPrice\n    value\n    __typename\n  }\n  purchasable\n  productPackagingQuantity\n  productProposedPackaging\n  productProposedPackaging2\n  stock {\n    inStock\n    inStockBeforeMaxAdvanceOrderingDate\n    partiallyInStock\n    availableFromDate\n    __typename\n  }\n  url\n  previouslyBought\n  nutriScoreLetter\n  isLowPriceGuarantee\n  isHouseholdBasket\n  freeGift\n  plasticFee\n  __typename\n}\n\nfragment ProductBadge on ProductBadge {\n  code\n  image {\n    ...Image\n    __typename\n  }\n  tooltipMessage\n  name\n  __typename\n}\n\nfragment Image on Image {\n  altText\n  format\n  galleryIndex\n  imageType\n  url\n  __typename\n}\n\nfragment MobileFee on MobileFee {\n  feeName\n  feeValue\n  __typename\n}\n\nfragment CategoryBreadcrumbs on CategoryBreadcrumb {\n  name\n  url\n  __typename\n}\n\nfragment Breadcrumbs on SearchBreadcrumb {\n  facetCode\n  facetName\n  facetValueName\n  facetValueCode\n  removeQuery {\n    query {\n      value\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment Facets on Facet {\n  code\n  name\n  category\n  facetUiType\n  values {\n    code\n    count\n    name\n    query {\n      query {\n        value\n        __typename\n      }\n      __typename\n    }\n    selected\n    __typename\n  }\n  __typename\n}\n\nfragment Pagination on Pagination {\n  currentPage\n  totalResults\n  totalPages\n  sort\n  __typename\n}"
    ); // sha256Hash = '8b68b8590c7d24f3ed8e338aa42e94e7d741766744bb9b9c87e15e18f332e4e5';

    for (let levels of categories.data.leftHandNavigationBar.levelInfo) {
        let levelStarts = 1;
        let page = 0,
            remains = 0;
        do {
            const query = `GetCategoryProductSearch&variables={"lang":"cs","searchQuery":"","category":"${levels.code}","pageNumber":${page},"pageSize":${blockOfPages},"filterFlag":true,"plainChildCategories":true}&extensions={"persistedQuery":{"version":1,"sha256Hash":"${sha256Hash}"}}`;
            console.log(`Albert ${ALBERT_BASE_URL + query}`);
            const res = await axios.get(ALBERT_BASE_URL + query, {
                validateStatus: function (status) {
                    return (status >= 200 && status < 300) || status == 429;
                },
            });
            if (levelStarts) {
                remains = res.data.data.categoryProductSearch.pagination.totalResults;
                console.log(
                    `Albert ${res.data.data.categoryProductSearch.pagination.totalPages} pages x ${blockOfPages} items => ${albertItems.length} existing + ${remains} new`
                );
                levelStarts = 0;
            }

            // exponential backoff
            backoff = 2000;
            while (res.status != 200) {
                console.info(`Albert API returned ${res.status}, retrying in ${backoff / 1000}s.`);
                await new Promise((resolve) => setTimeout(resolve, backoff));
                backoff *= 2;
                res = await axios.get(ALBERT_BASE_URL + query, {
                    validateStatus: function (status) {
                        return (status >= 200 && status < 300) || status == 429;
                    },
                });
            }
            let items = res.data.data.categoryProductSearch.products;
            for (let i = 0; i < items.length; i++) {
                items[i].categoryNames = levels.code;
            }
            albertItems = albertItems.concat(items);
            remains -= items.length;
            page++;
            await new Promise((resolve) => setTimeout(resolve, 100));
        } while (remains);
    }

    return albertItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem, item) => {
    if (item.categoryNames) return item.categoryNames;
    return null;
};

exports.urlBase = "https://www.albert.cz/";
