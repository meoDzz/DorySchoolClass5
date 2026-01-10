// ⚠️ GIỮ NGUYÊN LINK GAS CŨ CỦA BẠN
const GAS_URL = "https://script.google.com/macros/s/AKfycbx-G4y-WmXvqk8gHnsnRf63lFYdAyWrh6B90mmsmf4lsSAG-iGroM0YqXSS067twBBN/exec";

// DOM Elements
const loginContainer = document.getElementById('login-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');
const questionsWrapper = document.getElementById('questions-wrapper');
const loginMessage = document.getElementById('login-message');
const timeLeftSpan = document.getElementById('time-left');
const resultMessage = document.getElementById('result-message');
const resultDetail = document.getElementById('result-detail');

let currentQuestions = [];
let timerInterval;
const TOTAL_TIME = 300 * 60; // 15 phút
let startTime;

const globalAudio = new Audio();
let currentPlayingBtn = null;



// --- 1. HÀM BẮT ĐẦU ---
async function startQuiz() {
    const sbd = document.getElementById('student-sbd').value;
    const name = document.getElementById('student-name').value;
    const pass = document.getElementById('student-password').value;

    if (!sbd || !name || !pass) {
        loginMessage.textContent = "Vui lòng điền đủ thông tin!";
        return;
    }

    loginMessage.textContent = "Đang tải đề thi...";

    try {
        const res = await fetch('questionkhoi5.json');
        const data = await res.json();

        // 1. Lấy tất cả câu hỏi từ danh sách chung
        let allQuestions = data.questions || [];

        if (allQuestions.length === 0) throw new Error("Không có câu hỏi.");

        // 2. XÁO TRỘN THỨ TỰ CÂU HỎI
        // Nếu bạn muốn lấy hết: giữ nguyên
        // Nếu bạn muốn lấy ngẫu nhiên 20 câu trong kho 100 câu: .slice(0, 20)
        currentQuestions = shuffleArray(allQuestions);

        // 3. Render và bắt đầu
        renderQuestions();
        startTime = new Date();

        loginContainer.classList.add('hidden');
        quizContainer.classList.remove('hidden');
        startTimer(TOTAL_TIME);

    } catch (err) {
        loginMessage.textContent = "Lỗi tải đề: " + err.message;
        console.error(err);
    }
}

function renderQuestions() {
    // Hàm này bây giờ chỉ đóng vai trò khởi tạo
    currentIndex = 0;
    renderCurrentQuestion();

    // Gán sự kiện cho các nút
    document.getElementById('next-btn').onclick = handleNext;
    document.getElementById('early-submit-btn').onclick = () => {
        if (confirm("Bạn có chắc muốn nộp bài luôn không?")) {
            saveCurrentAnswer(); // Lưu nốt câu đang làm dở
            submitQuiz(false);
        }
    };
}

// Hàm hiển thị câu hỏi hiện tại
function renderCurrentQuestion() {
    questionsWrapper.innerHTML = "";

    // Kiểm tra nếu đã hết câu hỏi
    if (currentIndex >= currentQuestions.length) {
        submitQuiz(false); // Tự động nộp
        return;
    }

    const q = currentQuestions[currentIndex];
    const idx = currentIndex + 1; // Số thứ tự hiển thị (Câu 1, Câu 2...)

    // Xử lý nút Next: Nếu là câu cuối cùng thì đổi tên nút thành "Hoàn thành"
    const nextBtn = document.getElementById('next-btn');
    if (currentIndex === currentQuestions.length - 1) {
        nextBtn.textContent = "Hoàn thành & Nộp bài";
    } else {
        nextBtn.textContent = "Câu tiếp theo ➜";
    }

    // -- TẠO GIAO DIỆN (MEDIA & INPUT) --
    // (Logic này giữ nguyên như cũ, chỉ thay đổi cách gọi biến)

    let mediaHTML = "";
    if (q.image) mediaHTML += `<img src="${q.image}" class="q-img">`;

    // Nút Audio (Code sửa lỗi đã làm ở bước trước)
    if (q.audio) {
        let isLimited = q.limitListen ? "true" : "false";
        let limitText = q.limitListen ? `<span style="color:red; font-size:0.8em; margin-left:5px">(Nghe 1 lần)</span>` : "";
        mediaHTML += `
            <div class="audio-box">
                <button class="audio-btn" onclick="playGlobalAudio('${q.audio}', this, ${isLimited})">
                    🔊 Bấm để nghe
                </button>
                ${limitText}
            </div>`;
    }

    let answerHTML = "";
    // Tên input phải là duy nhất cho mỗi câu để không bị trùng cache trình duyệt
    let inputName = `q_current`;

    if (q.questionType === "fill_blank") {
        answerHTML = `<p style="font-style:italic;">${q.sentence}</p><input type="text" class="fill-input" id="input-fill" autocomplete="off">`;
    }
    else if (q.questionType === "arrange_images") {
        let shuffledItems = shuffleArray([...q.items]);
        let itemsHTML = shuffledItems.map(item => `
            <div class="arrange-item">
                <div class="arrange-label">${item.id}</div>
                <img src="${item.image}">
                <input type="number" class="arrange-input" data-id="${item.id}" min="1" max="10">
            </div>`).join('');
        answerHTML = `<div class="arrange-container">${itemsHTML}</div>`;
    }
    else if (q.questionType === "rearrange_words") {
        let shuffledWords = shuffleArray([...q.words]);
        let wordsHTML = shuffledWords.map(w => `<button class="word-btn" onclick="moveWord(this, '${idx}')">${w}</button>`).join('');
        // Lưu ý: id zone và bank cần unique một chút để hàm moveWord hoạt động
        answerHTML = `<div class="rearrange-container"><div class="answer-zone" id="zone-${idx}"></div><div class="word-bank" id="bank-${idx}">${wordsHTML}</div></div>`;
    }
    else { // Trắc nghiệm
        let isImg = q.optionType === "image";
        let cls = isImg ? "options-grid" : "options";
        let shuffledOptions = shuffleArray([...q.options]);
        let optsHTML = shuffledOptions.map(opt => {
            let content = isImg ? `<img src="${opt}">` : `<span>${opt}</span>`;
            let lc = isImg ? "option-image-box" : "";
            // Quan trọng: value="${opt}"
            return `<label class="${lc}"><input type="radio" name="${inputName}" value="${opt}"> ${content}</label>`;
        }).join('');
        answerHTML = `<div class="${cls}">${optsHTML}</div>`;
    }

    // Render ra màn hình
    questionsWrapper.innerHTML = `
        <div class="question-block" style="border:none;">
            <p class="question-text">Câu ${idx}: ${q.question}</p>
            <div class="question-media">${mediaHTML}</div>
            ${answerHTML}
        </div>`;
}

// ============================================================
// PHẦN 3: XỬ LÝ CHUYỂN CÂU & LƯU ĐÁP ÁN
// ============================================================

// Hàm xử lý khi bấm Next
function handleNext() {
    // 1. Lưu đáp án của câu hiện tại vào bộ nhớ
    saveCurrentAnswer();

    // 2. Dừng audio nếu đang phát
    if (!globalAudio.paused) globalAudio.pause();

    // 3. Tăng index và hiển thị câu tiếp theo
    currentIndex++;
    renderCurrentQuestion();
}

// Hàm lấy dữ liệu từ màn hình và nhét vào biến currentQuestions
function saveCurrentAnswer() {
    if (currentIndex >= currentQuestions.length) return;

    const q = currentQuestions[currentIndex];
    const idx = currentIndex + 1;
    let userVal = "Bỏ qua"; // Mặc định nếu không làm

    if (q.questionType === "fill_blank") {
        let inp = document.getElementById("input-fill");
        if (inp && inp.value.trim() !== "") userVal = inp.value.trim();
    }
    else if (q.questionType === "arrange_images") {
        let inps = document.querySelectorAll(`.arrange-input`);
        let arr = [];
        inps.forEach(i => { if (i.value) arr.push(i.dataset.id + "-" + i.value); });
        if (arr.length > 0) userVal = arr.join(", ");
    }
    else if (q.questionType === "rearrange_words") {
        let zone = document.getElementById(`zone-${idx}`);
        if (zone) {
            let btns = zone.querySelectorAll('.word-btn');
            let textArr = [];
            btns.forEach(b => textArr.push(b.textContent));
            if (textArr.length > 0) userVal = textArr.join(" ");
        }
    }
    else { // Trắc nghiệm
        let chk = document.querySelector(`input[name="q_current"]:checked`);
        if (chk) userVal = chk.value;
    }

    // QUAN TRỌNG: Lưu đáp án vào chính object câu hỏi trong mảng
    q.userSelectedAnswer = userVal;
}

// ============================================================
// PHẦN 4: NỘP BÀI (LOGIC MỚI)
// ============================================================

async function submitQuiz(isAutoSubmit = false) {
    clearInterval(timerInterval);

    // Ẩn nút điều hướng để tránh bấm lung tung
    document.querySelector('.control-bar').style.display = 'none';

    // Vì ta đã lưu đáp án vào q.userSelectedAnswer mỗi khi bấm Next,
    // nên giờ chỉ cần lôi từ mảng ra chấm thôi.

    // A. Tính giờ (Giữ nguyên)
    const endTime = new Date();
    const diffMs = endTime - startTime;
    const durationStr = msToTime(diffMs);
    const submitDateStr = endTime.toLocaleString('vi-VN');

    // B. Chấm điểm
    let score = 0;
    const totalQuestions = currentQuestions.length; // Tổng số câu trong bộ đề (dù làm hay chưa)
    const answers = [];

    currentQuestions.forEach((q, index) => {
        // Lấy đáp án đã lưu (nếu chưa làm tới thì là undefined)
        let userVal = q.userSelectedAnswer || "Chưa làm";

        let isCorrect = false;
        if (q.answer && compareAnswers(userVal, q.answer)) {
            score++;
            isCorrect = true;
        }

        answers.push({
            question: q.question,
            answer: userVal,
            correct: q.answer,
            isCorrect: isCorrect
        });
    });

    // C. Gửi đi (Giữ nguyên logic cũ)
    const finalScoreStr = `${score}/${totalQuestions}`;
    const payload = {
        sbd: document.getElementById('student-sbd').value,
        name: document.getElementById('student-name').value,
        class: document.getElementById('student-class').value,
        password: document.getElementById('student-password').value,
        answers: answers,
        score: finalScoreStr,
        submitTime: submitDateStr,
        duration: durationStr
    };

    // UI Nộp bài
    loginMessage.textContent = "Đang nộp bài..."; // Tận dụng thẻ p thông báo
    // (Phần fetch gửi lên GAS giữ nguyên như cũ)
    try {
        const req = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const res = await req.json();

        quizContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');

        if (res.success) {
            resultMessage.textContent = `🎉 Điểm: ${score}`;
            resultDetail.innerHTML = `
                <p>Thời gian: <strong>${durationStr}</strong></p>
                <p>Ngày nộp: ${submitDateStr}</p>
                <p>${res.message}</p>
            `;
            resultMessage.style.color = "#007bff";
        } else {
            resultMessage.textContent = "❌ Lỗi: " + res.message;
        }
    } catch (e) {
        alert("Lỗi mạng (Đã lưu điểm tạm thời): " + finalScoreStr);
    }
}

// --- CÁC HÀM HỖ TRỢ ---

// Hàm xáo trộn mảng (Fisher-Yates Shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function compareAnswers(user, correct) {
    const clean = (str) => str.toString().toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    return clean(user) === clean(correct);
}

function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;
    return hours + ":" + minutes + ":" + seconds;
}

function startTimer(duration) {
    let timer = duration;
    updateTimerDisplay(timer);
    timerInterval = setInterval(function () {
        timer--;
        updateTimerDisplay(timer);
        if (timer < 0) submitQuiz(true);
    }, 1000);
}

function updateTimerDisplay(timer) {
    let minutes = parseInt(timer / 60, 10);
    let seconds = parseInt(timer % 60, 10);
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
    timeLeftSpan.textContent = minutes + ":" + seconds;
    if (timer < 60) timeLeftSpan.style.color = "red";
}

window.moveWord = function (btn, idx) {
    const bank = document.getElementById(`bank-${idx}`);
    const zone = document.getElementById(`zone-${idx}`);
    if (btn.parentElement === bank) { zone.appendChild(btn); btn.classList.add('selected'); }
    else { bank.appendChild(btn); btn.classList.remove('selected'); }
}

window.disableAudio = function (el) {
    el.controls = false;
    let msg = document.createElement("span");
    msg.innerHTML = " ✅ Đã nghe xong";
    msg.style.color = "green";
    el.parentElement.appendChild(msg);
}

// --- HÀM XỬ LÝ AUDIO MỚI (FIX LỖI QUÁ NHIỀU PLAYER) ---
window.playGlobalAudio = function (url, btn, isLimited) {
    // 1. Nếu đang nghe chính nút này -> Tạm dừng
    if (currentPlayingBtn === btn && !globalAudio.paused) {
        globalAudio.pause();
        btn.innerHTML = "🔊 Tiếp tục nghe";
        btn.classList.remove("playing");
        return;
    }

    // 2. Nếu đang nghe bài khác -> Dừng bài cũ, reset nút cũ
    if (currentPlayingBtn && currentPlayingBtn !== btn) {
        currentPlayingBtn.innerHTML = "🔊 Bấm để nghe";
        currentPlayingBtn.classList.remove("playing");
        // Nếu bài cũ bị giới hạn nghe 1 lần -> Disable luôn
        if (currentPlayingBtn.dataset.limited === "true") {
            currentPlayingBtn.disabled = true;
            currentPlayingBtn.innerHTML = "✅ Đã nghe xong";
        }
    }

    // 3. Bắt đầu phát bài mới
    currentPlayingBtn = btn;
    btn.dataset.limited = isLimited; // Lưu trạng thái giới hạn vào nút
    btn.classList.add("playing");
    btn.innerHTML = "wm Đang phát..."; // Icon sóng nhạc

    globalAudio.src = url;
    globalAudio.play();

    // 4. Xử lý khi nghe xong
    globalAudio.onended = function () {
        btn.classList.remove("playing");
        if (isLimited) {
            btn.disabled = true;
            btn.innerHTML = "✅ Đã nghe xong";
        } else {
            btn.innerHTML = "🔊 Nghe lại";
        }
        currentPlayingBtn = null;
    };

    // Xử lý lỗi nếu file audio hỏng
    globalAudio.onerror = function () {
        btn.classList.remove("playing");
        btn.innerHTML = "❌ Lỗi file audio";
        alert("Không tải được file âm thanh này.");
    };
};

document.getElementById('start-btn').addEventListener('click', startQuiz);
document.getElementById('submit-btn').addEventListener('click', () => submitQuiz(false));