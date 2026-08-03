
const CONFIG = { 
    API_BASE: "https://onemy4-turbd.onrender.com/api",
    GATEWAY_BASE: "https://ve56ry12fy4.onrender.com/api"
};

class MiniApp {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.user = null;
        this.role = "USER";
        this.isUnlocked = false;
        this.activeTournament = null;
        this.userJoinedTournamentIds = new Set();
        this.allTournaments = [];

        this.initTelegram();
        this.bindEvents();
        this.bootstrap();
    }

    initTelegram() {
        if (this.tg) {
            try {
                this.tg.ready();
                this.tg.expand();
                this.tg.setHeaderColor('#0b0e14');
                this.tg.setBackgroundColor('#0b0e14');
            } catch (e) {
                console.warn("Telegram WebApp initialization error:", e);
            }
        }
    }

    // টেলিগ্রাম ইউজার ডাটা নিখুঁতভাবে ডিটেক্ট করার সেফ ফাংশন
    getTelegramUser() {
        // ১. সরাসরি Telegram WebApp object চেক
        if (this.tg?.initDataUnsafe?.user?.id) {
            const u = this.tg.initDataUnsafe.user;
            const userData = {
                id: Number(u.id),
                first_name: u.first_name || "Player",
                username: u.username || "",
                photo_url: u.photo_url || ""
            };
            localStorage.setItem("cached_tg_user", JSON.stringify(userData));
            return userData;
        }

        // ২. URL-এর initData প্যারামিটার থেকে ব্যাকআপ ডিটেকশন
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tgWebAppData = urlParams.get("tgWebAppData");
            if (tgWebAppData) {
                const decoded = decodeURIComponent(tgWebAppData);
                const userMatch = decoded.match(/user=([^&]+)/);
                if (userMatch && userMatch[1]) {
                    const parsedUser = JSON.parse(decodeURIComponent(userMatch[1]));
                    if (parsedUser.id) {
                        const userData = {
                            id: Number(parsedUser.id),
                            first_name: parsedUser.first_name || "Player",
                            username: parsedUser.username || "",
                            photo_url: parsedUser.photo_url || ""
                        };
                        localStorage.setItem("cached_tg_user", JSON.stringify(userData));
                        return userData;
                    }
                }
            }
        } catch (e) {
            console.warn("URL initData parsing fallback error:", e);
        }

        // ৩. ক্যাশড লোকাল স্টোরেজ চেক
        const cached = localStorage.getItem("cached_tg_user");
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {}
        }

        // ৪. ডিফল্ট এডমিন ফ্যালব্যাক (পরীক্ষার জন্য)
        return {
            id: 8908999062,
            first_name: "Admin Player",
            username: "admin_player",
            photo_url: "https://via.placeholder.com/40"
        };
    }

    // ইউজার টেলিগ্রাম আইডি পাওয়ার নিশ্চিত হেডার
    getTgIdHeader() {
        if (this.user?.telegram_id) return this.user.telegram_id.toString();
        const tgUser = this.getTelegramUser();
        return tgUser.id.toString();
    }

    async bootstrap() {
        const tgUserData = this.getTelegramUser();

        try {
            const response = await fetch(`${CONFIG.API_BASE}/auth/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    telegram_id: tgUserData.id,
                    username: tgUserData.username || "",
                    first_name: tgUserData.first_name || "Player",
                    photo_url: tgUserData.photo_url || ""
                })
            });

            const data = await response.json();
            if (data.status === "success") {
                this.user = data.user;
                this.role = data.role;
                this.isUnlocked = data.is_unlocked;
                this.renderUIState();
                this.loadTournaments();
                
                if (data.announcements && data.announcements.length > 0) {
                    this.showAnnouncementsModal(data.announcements);
                }
            } else if (data.detail) {
                alert(data.detail);
            }
        } catch (err) {
            console.error("Bootstrap authorization error:", err);
        }
    }

    checkUnlockGuard() {
        if (!this.isUnlocked) {
            alert("🔒 এই সুবিধাটি পেতে প্রথমে উপরে 'Unlock 24h Access' বাটনে ক্লিক করে আনলক করুন!");
            return false;
        }
        return true;
    }

    showAnnouncementsModal(list) {
        const modal = document.getElementById("popup-announcement-modal");
        const body = document.getElementById("popup-announcements-body");
        if (!modal || !body) return;
        
        body.innerHTML = "";
        list.forEach(ann => {
            body.innerHTML += `
                <div class="announcement-item margin-top">
                    ${ann.image_url ? `<img src="${ann.image_url}" class="announcement-img" onerror="this.style.display='none'">` : ''}
                    <p class="announcement-text">${ann.text}</p>
                </div>
            `;
        });
        modal.classList.remove("hidden");
    }

    closeAnnouncements() {
        document.getElementById("popup-announcement-modal")?.classList.add("hidden");
    }

    renderUIState() {
        const currentTgId = this.getTgIdHeader();
        const userNameEl = document.getElementById("user-name");
        
        if (userNameEl) {
            userNameEl.innerText = this.user?.first_name || "Player";
        }

        const userAvatar = document.getElementById("user-avatar");
        const profileImg = document.getElementById("profile-img");
        const photoUrl = this.user?.photo_url || "https://via.placeholder.com/40";
        if (userAvatar) userAvatar.src = photoUrl;
        if (profileImg) profileImg.src = photoUrl;

        const profileName = document.getElementById("profile-name");
        const profileIdTag = document.getElementById("profile-id-tag");
        if (profileName) profileName.innerText = this.user?.first_name || "Player";
        if (profileIdTag) profileIdTag.innerText = `ID: ${currentTgId}`;

        const cardUserVerify = document.getElementById("card-user-verify");
        if (this.user?.ff_uid && this.user?.whatsapp) {
            const profFfUid = document.getElementById("prof-ff-uid");
            const profWa = document.getElementById("prof-wa");
            if (profFfUid) profFfUid.innerText = `FF UID: ${this.user.ff_uid}`;
            if (profWa) profWa.innerText = `WhatsApp: ${this.user.whatsapp}`;
            if (cardUserVerify) cardUserVerify.classList.add("hidden");
        } else {
            if (cardUserVerify) cardUserVerify.classList.remove("hidden");
        }

        const badge = document.getElementById("unlock-badge");
        const btnAdUnlock = document.getElementById("btn-ad-unlock");

        if (this.isUnlocked) {
            if (badge) {
                badge.className = "badge unlocked";
                badge.innerText = "UNLOCKED 24H";
            }
            if (btnAdUnlock) btnAdUnlock.classList.add("hidden");
        } else {
            if (badge) {
                badge.className = "badge locked";
                badge.innerText = "LOCKED";
            }
            if (btnAdUnlock) btnAdUnlock.classList.remove("hidden");
        }

        const tabAdmin = document.getElementById("tab-admin");
        if (tabAdmin) {
            if (this.role === "MAIN_ADMIN") {
                tabAdmin.classList.remove("hidden");
                this.loadAdminData();
            } else {
                tabAdmin.classList.add("hidden");
            }
        }

        const tabCreator = document.getElementById("tab-creator");
        if (tabCreator) {
            if (this.role === "CREATOR" || this.role === "MAIN_ADMIN") {
                tabCreator.classList.remove("hidden");
                this.generateSubAdminScriptCode();
            } else {
                tabCreator.classList.add("hidden");
            }
        }

        this.loadMySquads();
    }

    bindEvents() {
        document.querySelectorAll(".tab-bar .tab-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".tab-bar .tab-btn").forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                this.navigate(e.target.getAttribute("data-target"));
            });
        });

        document.getElementById("form-leader-registration")?.addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleLeaderRegistration();
        });

        document.getElementById("form-create-tournament")?.addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleCreateTournament();
        });

        document.getElementById("form-user-verify")?.addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleUserVerification();
        });
    }

    generateSubAdminScriptCode() {
        const codeBox = document.getElementById("sub-admin-script-box");
        if (codeBox) {
            codeBox.value = `<!-- Esports Secure Verification Button -->\n<div id="esports-verify-widget"></div>\n<script src="${CONFIG.GATEWAY_BASE}/sdk.js" async></script>`;
        }
    }

    copyScriptCode() {
        const codeBox = document.getElementById("sub-admin-script-box");
        if (codeBox && codeBox.value) {
            navigator.clipboard.writeText(codeBox.value).then(() => {
                alert("📋 সাব-এডমিন ওয়েবসাইট কোড কপি হয়েছে!");
            });
        }
    }

    navigate(viewId) {
        document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.add("active");
        if (viewId === "view-profile") {
            this.loadMySquads();
        }
    }

    async handleUserVerification() {
        if (!this.checkUnlockGuard()) return;

        const payload = {
            ff_uid: document.getElementById("input-verify-uid")?.value.trim(),
            whatsapp_number: document.getElementById("input-verify-wa")?.value.trim()
        };

        const res = await fetch(`${CONFIG.API_BASE}/user/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            this.user = data.user;
            this.renderUIState();
            alert("✅ তথ্য সফলভাবে ভেরিফাই ও সেভ হয়েছে!");
        } else {
            alert(`⚠️ ${data.detail}`);
        }
    }

    async loadTournaments() {
        const container = document.getElementById("tournament-list");
        if (!container) return;

        try {
            const res = await fetch(`${CONFIG.API_BASE}/tournaments`, {
                headers: { "X-TG-ID": this.getTgIdHeader() }
            });
            const data = await res.json();
            this.allTournaments = data.tournaments || [];
            window.tournamentCache = this.allTournaments;
            this.renderTournamentsList(this.allTournaments);
            this.renderCreatorRoomPanel(this.allTournaments);
        } catch (err) {
            container.innerHTML = `<div class="sub-text">Error loading tournaments.</div>`;
        }
    }

    searchTournaments() {
        const q = (document.getElementById("input-search-tournaments")?.value || "").toLowerCase().trim();
        if (!q) {
            this.renderTournamentsList(this.allTournaments);
            return;
        }
        const filtered = this.allTournaments.filter(t => 
            (t.code && t.code.toLowerCase().includes(q)) || 
            (t.start_time && t.start_time.toLowerCase().includes(q)) ||
            (t.title && t.title.toLowerCase().includes(q))
        );
        this.renderTournamentsList(filtered);
    }

    renderTournamentsList(list) {
        const container = document.getElementById("tournament-list");
        if (!container) return;
        container.innerHTML = "";

        if (!list || list.length === 0) {
            container.innerHTML = `<div class="sub-text align-center">বর্তমানে কোনো টুর্নামেন্ট চালু নেই।</div>`;
            return;
        }

        list.forEach(t => {
            const card = document.createElement("div");
            card.className = "glass-card tournament-item";
            
            let statusBadge = `<span style="color:var(--accent-gold); font-weight:bold;">🕒 ${t.start_time}</span>`;
            if (t.is_cancelled) {
                statusBadge = `<span style="color:#e53e3e; font-weight:bold;">⚠️ ক্যানসেল করা হয়েছে</span>`;
            } else if (t.status === "STARTED") {
                statusBadge = `<span style="color:#2e7d32; font-weight:bold;">▶ Match Running</span>`;
            }

            let roomNotice = "";
            if (t.is_cancelled) {
                roomNotice = `<div class="player-box margin-top" style="border-color:#e53e3e; color:#feb2b2;">${t.cancel_message}</div>`;
            }

            card.innerHTML = `
                <div class="tournament-header">
                    <span>${t.code} (${t.total_joined_squads}/12 Squads)</span>
                    <span style="color:var(--accent-orange); cursor:pointer;" onclick="app.openHostProfile(${t.creator_id})">Squad Host 🔗</span>
                </div>
                <div class="tournament-title">${t.title}</div>
                <div class="tournament-meta">
                    <span>🏆 ${t.prize}</span> | ${statusBadge}
                </div>
                ${roomNotice}
                <button class="btn-action full-width margin-top" onclick="app.openTournamentDetail('${t.id}')">Join / View Details</button>
            `;
            container.appendChild(card);
        });
    }

    renderCreatorRoomPanel(list) {
        const container = document.getElementById("creator-room-management");
        if (!container) return;
        container.innerHTML = "";

        const currentTgId = Number(this.getTgIdHeader());
        if (this.role !== "CREATOR" && this.role !== "MAIN_ADMIN") return;

        const myTournaments = list.filter(t => t.creator_id === currentTgId || this.role === "MAIN_ADMIN");
        if (myTournaments.length === 0) {
            container.innerHTML = `<p class="sub-text">আপনার তৈরি কোনো টুর্নামেন্ট পাওয়া যায়নি।</p>`;
            return;
        }

        myTournaments.forEach(t => {
            container.innerHTML += `
                <div class="player-box margin-top">
                    <h4>${t.title} (${t.code})</h4>
                    <p class="sub-text">Start Time: ${t.start_time}</p>
                    <div class="input-group margin-top">
                        <label>Room ID</label>
                        <input type="text" id="rm-id-${t.id}" value="${t.room_id !== 'PROTECTED' ? t.room_id || '' : ''}" placeholder="Enter Room ID">
                    </div>
                    <div class="input-group">
                        <label>Room Password</label>
                        <input type="text" id="rm-pass-${t.id}" value="${t.room_password !== 'PROTECTED' ? t.room_password || '' : ''}" placeholder="Enter Password">
                    </div>
                    <div class="input-group">
                        <label>Edit Start Time (Optional)</label>
                        <input type="text" id="rm-time-${t.id}" value="${t.start_time || ''}">
                    </div>
                    <button class="btn-action full-width margin-top" onclick="app.submitRoomCredentials('${t.id}')">📤 Save Room Credentials</button>
                    <button class="btn-secondary full-width margin-top" onclick="app.deleteTournament('${t.id}')">🗑 Delete Tournament</button>
                </div>
            `;
        });
    }

    async submitRoomCredentials(tId) {
        if (!this.checkUnlockGuard()) return;

        const roomId = document.getElementById(`rm-id-${tId}`)?.value.trim();
        const roomPass = document.getElementById(`rm-pass-${tId}`)?.value.trim();
        const newTime = document.getElementById(`rm-time-${tId}`)?.value.trim();

        if (!roomId || !roomPass) {
            alert("রুম আইডি এবং পাসওয়ার্ড উভয়ই লিখুন!");
            return;
        }

        const res = await fetch(`${CONFIG.API_BASE}/tournaments/upload-room`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify({
                tournament_id: tId,
                room_id: roomId,
                room_password: roomPass,
                new_start_time: newTime
            })
        });

        if (res.ok) {
            alert("✅ রুম আইডি ও পাসওয়ার্ড সফলভাবে আপলোড হয়েছে!");
            this.loadTournaments();
        } else {
            alert("⚠️ রুম তথ্য সেভ করতে সমস্যা হয়েছে!");
        }
    }

    openTournamentDetail(tId) {
        const t = window.tournamentCache?.find(x => x.id === tId);
        if (!t) return;
        this.activeTournament = t;
        
        const regInput = document.getElementById("reg-tournament-id");
        if (regInput) regInput.value = t.id;

        const card = document.getElementById("tournament-detail-card");
        if (card) {
            let roomInfoBox = "";
            if (t.has_credentials && t.room_id !== "PROTECTED") {
                roomInfoBox = `
                    <div class="player-box margin-top" style="border: 2px solid var(--accent-orange);">
                        <h4 style="color:var(--accent-gold)">🔑 Room Credentials Access</h4>
                        <p><strong>Room ID:</strong> ${t.room_id}</p>
                        <p><strong>Password:</strong> ${t.room_password}</p>
                    </div>
                `;
            } else if (t.is_cancelled) {
                roomInfoBox = `<div class="player-box margin-top" style="border-color:#e53e3e; color:#feb2b2;">${t.cancel_message}</div>`;
            }

            card.innerHTML = `
                <h2>${t.title} (${t.code})</h2>
                <p><strong>Lobby Slots:</strong> ${t.total_joined_squads}/12 Squads Joined</p>
                <p><strong>Start Time:</strong> ${t.start_time}</p>
                ${roomInfoBox}
                <p class="margin-top"><strong>Rules:</strong> ${t.rules}</p>
            `;
        }
        this.navigate("view-details");
    }

    async showRegisteredSquads() {
        const box = document.getElementById("registered-squads-box");
        if (!box) return;

        box.classList.remove("hidden");
        box.innerHTML = "<h4>Registered Squads</h4>";
        const t = this.activeTournament;
        
        if (!t || !t.squads || Object.keys(t.squads).length === 0) {
            box.innerHTML += `<p class="sub-text margin-top">এখনো কোনো স্কোয়াড রেজিস্ট্রেশন করেনি।</p>`;
            return;
        }

        Object.values(t.squads).forEach(sq => {
            let membersList = sq.members.map(m => `<li>${m.nickname} (UID: ${m.ff_id}) - ${m.role}</li>`).join("");
            box.innerHTML += `
                <div class="player-box margin-top">
                    <strong>${sq.squad_name}</strong>
                    <ul class="sub-text margin-top">${membersList}</ul>
                </div>
            `;
        });
    }

    async handleLeaderRegistration() {
        if (!this.checkUnlockGuard()) return;

        if (!this.user?.ff_uid) {
            alert("⚠️ আগে আপনার প্রোফাইলে গিয়ে Free Fire UID দিয়ে ভেরিফাই করুন!");
            this.navigate("view-profile");
            return;
        }

        const payload = {
            tournament_id: document.getElementById("reg-tournament-id")?.value,
            squad_name: document.getElementById("reg-squad-name")?.value,
            p1_nickname: document.getElementById("p1-nick")?.value,
            p1_ff_id: document.getElementById("p1-id")?.value
        };

        const res = await fetch(`${CONFIG.API_BASE}/tournaments/register-leader`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            const redirectUrl = `${data.task_link}?token=${encodeURIComponent(data.auth_token)}`;
            alert(`🎉 Squad Registration Successful!\nSquad Code: ${data.squad_code}\n\n১৫ সেকেন্ড অবস্থানের জন্য সাব-এডমিনের সাইটে পাঠানো হচ্ছে...`);
            
            if (this.tg && this.tg.openLink) {
                this.tg.openLink(redirectUrl);
            } else {
                window.open(redirectUrl, "_blank");
            }
            this.loadTournaments();
            this.navigate("view-home");
        } else {
            alert(`⚠️ ${data.detail}`);
        }
    }

    async submitJoinSquad() {
        if (!this.checkUnlockGuard()) return;

        if (!this.user?.ff_uid) {
            alert("⚠️ আগে প্রোফাইল ট্যাবে গিয়ে আপনার FF UID সেভ করুন!");
            this.navigate("view-profile");
            return;
        }

        const payload = {
            squad_code: document.getElementById("join-sq-code")?.value.trim(),
            nickname: document.getElementById("join-p-nick")?.value.trim(),
            ff_id: document.getElementById("join-p-uid")?.value.trim()
        };

        const res = await fetch(`${CONFIG.API_BASE}/tournaments/join-squad`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            const redirectUrl = `${data.task_link}?token=${encodeURIComponent(data.auth_token)}`;
            alert("✅ স্কোয়াডে জয়েন সফল হয়েছে!\n\n১৫ সেকেন্ড অবস্থানের জন্য সাব-এডমিনের সাইটে পাঠানো হচ্ছে...");
            
            if (this.tg && this.tg.openLink) {
                this.tg.openLink(redirectUrl);
            } else {
                window.open(redirectUrl, "_blank");
            }
            this.loadTournaments();
            this.navigate("view-home");
        } else {
            alert(`⚠️ ${data.detail}`);
        }
    }

    async loadMySquads() {
        const container = document.getElementById("my-squads-list");
        if (!container) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/user/my-squads`, {
                headers: { "X-TG-ID": this.getTgIdHeader() }
            });
            const data = await res.json();
            container.innerHTML = "";
            if (!data.squads || data.squads.length === 0) {
                container.innerHTML = `<p class="sub-text">আপনার যুক্ত থাকা কোনো সক্রিয় স্কোয়াড নেই।</p>`;
                return;
            }

            data.squads.forEach(sq => {
                let mList = sq.members.map(m => `<li>${m.nickname} (UID: ${m.ff_id}) - ${m.role}</li>`).join("");
                
                let roomBox = "";
                if (sq.room_id && sq.room_password) {
                    roomBox = `
                        <div class="player-box margin-top" style="background:#1c2d20; border-color:#2e7d32;">
                            <strong style="color:#81c784;">🔑 Room Access Code</strong>
                            <div>Room ID: <code>${sq.room_id}</code></div>
                            <div>Password: <code>${sq.room_password}</code></div>
                        </div>
                    `;
                } else if (sq.is_cancelled) {
                    roomBox = `<div class="player-box margin-top" style="border-color:#e53e3e; color:#feb2b2;">${sq.cancel_message}</div>`;
                } else {
                    roomBox = `<div class="sub-text margin-top">⏳ রুম আইডি ও পাসওয়ার্ড হোস্ট আপলোড করলে এখানে দেখাবে।</div>`;
                }

                container.innerHTML += `
                    <div class="player-box margin-top">
                        <div><strong>${sq.tournament_title} (${sq.squad_name})</strong></div>
                        <div class="sub-text" style="color:var(--accent-orange); display: flex; align-items: center; gap: 8px;">
                            Private Code: <code>${sq.squad_code}</code>
                            <button class="btn-secondary" style="padding: 2px 8px; font-size: 11px;" onclick="app.copyToClipboard('${sq.squad_code}')">📋 Copy</button>
                        </div>
                        <ul class="sub-text margin-top">${mList}</ul>
                        ${roomBox}
                        <button class="btn-secondary full-width margin-top" onclick="app.deleteMySquad('${sq.squad_code}')">❌ Leave / Delete Squad</button>
                    </div>
                `;
            });
        } catch (err) {
            container.innerHTML = `<p class="sub-text">Error loading squads.</p>`;
        }
    }

    async deleteMySquad(sqCode) {
        if (!this.checkUnlockGuard()) return;
        if (!confirm("আপনি কি নিশ্চিত এই স্কোয়াড থেকে বের হতে বা ডিলিট করতে চান?")) return;
        
        const res = await fetch(`${CONFIG.API_BASE}/tournaments/squad/${sqCode}`, {
            method: "DELETE",
            headers: { "X-TG-ID": this.getTgIdHeader() }
        });
        if (res.ok) {
            alert("স্কোয়াড রিমুভ সফল হয়েছে!");
            this.loadMySquads();
            this.loadTournaments();
        }
    }

    async showAdAndUnlock() {
        if (typeof show_11466993 === 'function') {
            show_11466993('pop').then(async () => {
                await this.verifyAdReward();
            }).catch((e) => {
                console.error("Ad error:", e);
                this.verifyAdReward();
            });
        } else {
            await this.verifyAdReward();
        }
    }

    async verifyAdReward() {
        const res = await fetch(`${CONFIG.API_BASE}/user/unlock-ad`, {
            method: "POST",
            headers: { "X-TG-ID": this.getTgIdHeader() }
        });
        if (res.ok) {
            this.isUnlocked = true;
            this.renderUIState();
            alert("🔓 Congratulations! 24-Hour Access Unlocked.");
        }
    }

    async deleteTournament(tId) {
        if (!this.checkUnlockGuard()) return;
        if (!confirm("আপনি কি নিশ্চিত টুর্নামেন্টটি মুছে ফেলতে চান?")) return;
        
        await fetch(`${CONFIG.API_BASE}/tournaments/${tId}`, {
            method: "DELETE",
            headers: { "X-TG-ID": this.getTgIdHeader() }
        });
        this.loadTournaments();
    }

    async saveHostProfile(e) {
        e.preventDefault();
        if (!this.checkUnlockGuard()) return;

        const currentTgId = Number(this.getTgIdHeader());

        const payload = {
            telegram_id: currentTgId,
            squad_name: document.getElementById("cp-squad-name")?.value,
            description: document.getElementById("cp-desc")?.value,
            player_roles: document.getElementById("cp-roles")?.value,
            youtube: document.getElementById("cp-yt")?.value,
            facebook: document.getElementById("cp-fb")?.value,
            tiktok: document.getElementById("cp-tk")?.value
        };

        const res = await fetch(`${CONFIG.API_BASE}/creator/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify(payload)
        });
        if (res.ok) alert("✅ Squad Host Profile Saved!");
    }

    async handleCreateTournament() {
        if (!this.checkUnlockGuard()) return;

        const payload = {
            title: document.getElementById("cr-title")?.value,
            code: document.getElementById("cr-code")?.value,
            prize: document.getElementById("cr-prize")?.value,
            task_description: document.getElementById("cr-task-desc")?.value,
            task_link: document.getElementById("cr-task-link")?.value,
            rules: document.getElementById("cr-rules")?.value,
            start_time: document.getElementById("cr-time")?.value
        };

        const res = await fetch(`${CONFIG.API_BASE}/tournaments/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("✅ Tournament Published!");
            this.loadTournaments();
            this.navigate("view-home");
        }
    }

    async openHostProfile(creatorId) {
        const res = await fetch(`${CONFIG.API_BASE}/hosts/${creatorId}`);
        const host = await res.json();
        if (host) {
            document.getElementById("host-squad-name").innerText = host.squad_name || "Official Host Squad";
            document.getElementById("host-desc").innerText = host.description || "No description provided.";
            document.getElementById("host-roles").innerText = host.player_roles || "N/A";
            
            const yt = document.getElementById("host-yt");
            if (yt) { if (host.youtube) { yt.href = host.youtube; yt.classList.remove("hidden"); } else { yt.classList.add("hidden"); } }
            
            const fb = document.getElementById("host-fb");
            if (fb) { if (host.facebook) { fb.href = host.facebook; fb.classList.remove("hidden"); } else { fb.classList.add("hidden"); } }

            const tk = document.getElementById("host-tk");
            if (tk) { if (host.tiktok) { tk.href = host.tiktok; tk.classList.remove("hidden"); } else { tk.classList.add("hidden"); } }

            this.navigate("view-host-profile");
        }
    }

    // Admin Control Logic
    async loadAdminData() {
        const res = await fetch(`${CONFIG.API_BASE}/admin/dashboard`, {
            headers: { "X-TG-ID": this.getTgIdHeader() }
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById("adm-total-users").innerText = data.total_users;
            document.getElementById("adm-total-tournaments").innerText = data.active_tournaments;
            document.getElementById("adm-total-ads").innerText = data.total_ad_views;

            window.allAdminUsers = data.users;
            window.allBannedUsers = data.banned_users;

            const annContainer = document.getElementById("adm-announcements-list");
            if (annContainer) {
                annContainer.innerHTML = "";
                data.announcements.forEach(a => {
                    annContainer.innerHTML += `
                        <div class="player-box margin-top">
                            ${a.image_url ? `<img src="${a.image_url}" style="max-width:100%; border-radius:8px;">` : ''}
                            <p>${a.text}</p>
                            <button class="btn-secondary full-width margin-top" onclick="app.deleteAnnouncement('${a.id}')">🗑 Delete Pop-up Notice</button>
                        </div>
                    `;
                });
            }

            const crContainer = document.getElementById("adm-creators-list");
            if (crContainer) {
                crContainer.innerHTML = "";
                data.creators.forEach(c => {
                    crContainer.innerHTML += `
                        <div class="player-box">
                            <strong>${c.squad_name}</strong> (ID: ${c.telegram_id})
                            <button class="btn-secondary full-width margin-top" onclick="app.removeCreatorByAdmin(${c.telegram_id})">❌ Remove Host Role</button>
                        </div>
                    `;
                });
            }

            this.filterAdminUsers();
        }
    }

    async uploadDatabaseJson() {
        const fileInput = document.getElementById("adm-json-file");
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert("অনুগ্রহ করে একটি .json ফাইল সিলেক্ট করুন!");
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const jsonContent = JSON.parse(e.target.result);
                const res = await fetch(`${CONFIG.API_BASE}/admin/import-data`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "X-TG-ID": this.getTgIdHeader()
                    },
                    body: JSON.stringify(jsonContent)
                });
                const responseData = await res.json();
                if (res.ok) {
                    alert("✅ " + responseData.message);
                    this.loadAdminData();
                    this.loadTournaments();
                } else {
                    alert("⚠️ ডাটা ইমপোর্ট ব্যর্থ হয়েছে!");
                }
            } catch (err) {
                alert("⚠️ সিলেক্ট করা JSON ফাইলটিতে ফরম্যাট সংক্রান্ত ভুল রয়েছে!");
            }
        };

        reader.readAsText(file);
    }

    filterAdminUsers() {
        const query = (document.getElementById("adm-user-search")?.value || "").toLowerCase().trim();
        const usrContainer = document.getElementById("adm-users-list");
        if (!usrContainer) return;
        usrContainer.innerHTML = "";

        if (!window.allAdminUsers) return;

        window.allAdminUsers.forEach(u => {
            const isBanned = window.allBannedUsers?.includes(u.telegram_id);
            const isMainAdmin = (u.telegram_id === 8908999062);

            const matchName = (u.first_name || "").toLowerCase().includes(query);
            const matchUID = (u.ff_uid || "").toLowerCase().includes(query);
            const matchTG = u.telegram_id.toString().includes(query);

            if (!query || matchName || matchUID || matchTG) {
                usrContainer.innerHTML += `
                    <div class="player-box">
                        <div><strong>${u.first_name}</strong> (@${u.username || 'N/A'}) ${isMainAdmin ? '👑 (Main Admin)' : ''}</div>
                        <div class="sub-text">TG ID: ${u.telegram_id}</div>
                        <div class="sub-text">
                            FF UID: ${u.ff_uid || 'Not Set'}
                            ${u.ff_uid ? `<button class="btn-secondary" style="padding:2px 8px; font-size:11px; margin-left:5px;" onclick="app.copyToClipboard('${u.ff_uid}')">📋 Copy</button>` : ''}
                        </div>
                        <div class="sub-text">
                            WhatsApp: ${u.whatsapp || 'Not Set'}
                            ${u.whatsapp ? `<button class="btn-secondary" style="padding:2px 8px; font-size:11px; margin-left:5px;" onclick="app.copyToClipboard('${u.whatsapp}')">📋 Copy</button>` : ''}
                        </div>
                        ${isMainAdmin ? `
                            <button class="btn-secondary full-width margin-top" disabled style="opacity:0.5;">👑 Main Admin Protected</button>
                        ` : isBanned 
                            ? `<button class="btn-action full-width margin-top" onclick="app.unbanUserByAdmin(${u.telegram_id})">✅ Unban User</button>`
                            : `<button class="btn-secondary full-width margin-top" onclick="app.banUserByAdmin(${u.telegram_id})">🚫 Ban User</button>`
                        }
                    </div>
                `;
            }
        });
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert(`Copied: ${text}`);
        }).catch(() => {
            alert("Failed to copy!");
        });
    }

    async publishAnnouncement() {
        const text = document.getElementById("adm-popup-msg")?.value.trim();
        const img = document.getElementById("adm-popup-img")?.value.trim();
        if (!text) {
            alert("পপ-আপ এর টেক্সট মেসেজ লিখুন!");
            return;
        }

        await fetch(`${CONFIG.API_BASE}/admin/announcement/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify({ text: text, image_url: img })
        });
        document.getElementById("adm-popup-msg").value = "";
        document.getElementById("adm-popup-img").value = "";
        alert("📢 পপ-আপ অ্যানাউন্সমেন্ট প্রকাশিত হয়েছে!");
        this.loadAdminData();
    }

    async deleteAnnouncement(annId) {
        await fetch(`${CONFIG.API_BASE}/admin/announcement/${annId}`, {
            method: "DELETE",
            headers: { "X-TG-ID": this.getTgIdHeader() }
        });
        this.loadAdminData();
    }

    async addCreatorByAdmin() {
        const payload = {
            telegram_id: parseInt(document.getElementById("adm-cr-id")?.value),
            squad_name: document.getElementById("adm-cr-name")?.value
        };
        await fetch(`${CONFIG.API_BASE}/admin/creators/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify(payload)
        });
        alert("✅ Sub-Admin added successfully!");
        this.loadAdminData();
    }

    async removeCreatorByAdmin(creatorId) {
        if (!confirm("Are you sure you want to remove this host role?")) return;
        await fetch(`${CONFIG.API_BASE}/admin/creators/${creatorId}`, {
            method: "DELETE",
            headers: { "X-TG-ID": this.getTgIdHeader() }
        });
        this.loadAdminData();
    }

    async banUserByAdmin(tgId) {
        if (tgId === 8908999062) {
            alert("⚠️ মেইন এডমিনকে ব্লক করা সম্ভব নয়!");
            return;
        }
        await fetch(`${CONFIG.API_BASE}/admin/users/ban`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify({ telegram_id: tgId })
        });
        this.loadAdminData();
    }

    async unbanUserByAdmin(tgId) {
        await fetch(`${CONFIG.API_BASE}/admin/users/unban`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.getTgIdHeader() },
            body: JSON.stringify({ telegram_id: tgId })
        });
        this.loadAdminData();
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.app = new MiniApp();
});


