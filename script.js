document.addEventListener("DOMContentLoaded", function () {
    const fileInput = document.getElementById("fileInput");
    const dropZone = document.getElementById("dropZone");

    fileInput.addEventListener("change", handleFileUpload);

    // Kéo & thả file
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = "#faedcd";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.backgroundColor = "#fefae0";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = "#fefae0";
        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            handleFileUpload({ target: fileInput });
        }
    });
});

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    let opfPath = "";
    for (let filename in contents.files) {
        if (filename.endsWith(".opf")) {
            opfPath = filename;
            break;
        }
    }

    if (!opfPath) {
        alert("Không tìm thấy metadata trong EPUB này!");
        return;
    }

    const opfData = await zip.file(opfPath).async("text");
    extractMetadata(opfData, zip);
    displayEpubContents(zip);
}

async function extractMetadata(xml, zip) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "application/xml");

    const title = xmlDoc.getElementsByTagName("dc:title")[0]?.textContent || "Không có tiêu đề";
    const author = xmlDoc.getElementsByTagName("dc:creator")[0]?.textContent || "Không có tác giả";
    const language = xmlDoc.getElementsByTagName("dc:language")[0]?.textContent || "Không rõ ngôn ngữ";

    // Tìm ảnh bìa trong EPUB
    let coverPath = "";
    const metaTags = xmlDoc.getElementsByTagName("meta");
    for (let meta of metaTags) {
        if (meta.getAttribute("name") === "cover") {
            const coverId = meta.getAttribute("content");
            const coverItem = xmlDoc.querySelector(`item[id="${coverId}"]`);
            if (coverItem) coverPath = coverItem.getAttribute("href");
            break;
        }
    }

    // Nếu có ảnh bìa, hiển thị nó
    let coverImage = "";
    if (coverPath) {
        for (let filename in zip.files) {
            if (filename.endsWith(coverPath)) {
                const blob = await zip.file(filename).async("blob");
                const url = URL.createObjectURL(blob);
                coverImage = `<img src="${url}" class="cover">`;
                break;
            }
        }
    }

    // Hiển thị metadata
    const metadataDiv = document.getElementById("metadata");
    metadataDiv.innerHTML = `
        <h2>📌 Thông tin tác phẩm</h2>
        ${coverImage}
        <div class="metadata-item"><strong>📖 Tiêu đề:</strong> ${title}</div>
        <div class="metadata-item"><strong>✍ Tác giả:</strong> ${author}</div>
        <div class="metadata-item"><strong>🌎 Ngôn ngữ:</strong> ${language}</div>
		`;
    metadataDiv.style.display = "block"; // Hiện metadata
}

const MISTRAL_API_KEY = "murvk8TdxO4Rr1OkgIE3TWb8wR070Rsd"; 

async function summarizeTextWithMistral(text) {
    try {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MISTRAL_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "mistral-small", // Hoặc "mistral-medium", "mixtral"
                messages: [
                    { role: "system", content: "Bạn là một trợ lý AI chuyên tóm tắt sách. Hãy trả lời bằng tiếng Việt." },
                    { role: "user", content: `Hãy tóm tắt đoạn văn sau bằng tiếng Việt, dưới 300 từ:\n\n${text}` }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();
        return data.choices[0]?.message?.content || "Không thể tạo tóm tắt.";
    } catch (error) {
        console.error("Lỗi khi gọi API Mistral:", error);
        return "Lỗi khi tạo tóm tắt.";
    }
}

async function displayEpubContents(zip) {
    let textContent = "";

    for (let filename in zip.files) {
        if (filename.endsWith(".xhtml") || filename.endsWith(".html")) {
            const fileContent = await zip.file(filename).async("text");
            textContent += fileContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    if (!textContent) {
        document.getElementById("epubPreview").innerHTML = "Không có nội dung hiển thị!";
        return;
    }

    let words = textContent.split(" ");
    let excerpt = words.slice(0, 1000).join(" "); // Giới hạn khoảng 1000 từ đầu

    document.getElementById("epubPreview").innerHTML = "⏳ Đang tạo tóm tắt...";

    let summary = await summarizeTextWithMistral(excerpt);
    document.getElementById("epubPreview").innerHTML = summary;
}
