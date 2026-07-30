const CONFIG = { API_BASE: "https://onemy4-turbd.onrender.com/api" };

class MiniApp {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.user = null;
        this.role = "USER";
        this.isUnlocked = false;
        this.activeTournament = null;
        this.redirectTimer = null;

        this.initTelegram();
        this.bindEvents();
        this.bootstrap();
    }

    initTelegram() {
        if (this.tg) {
            this.tg.ready();
            this.tg.expand();
            this.tg.setHeaderColor('#0b0e14');
            this.tg.setBackgroundColor('#0b0e14');
        }
    }

    async bootstrap() {
        const tgUserData = this.tg?.initDataUnsafe?.user || {
            id: 8908999062, // Default Main Admin ID
            first_name: "Admin Player",
            username: "admin_player",
            photo_url: "https://via.placeholder.com/40"
        };

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
            console.error("Bootstrap error:", err);
        }
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
        if (!this.user) return;

        const userNameEl = document.getElementById("user-name");
        if (userNameEl) userNameEl.innerText = this.user.first_name;

        if (this.user.photo_url) {
            const userAvatar = document.getElementById("user-avatar");
            const profileImg = document.getElementById("profile-img");
            if (userAvatar) userAvatar.src = this.user.photo_url;
            if (profileImg) profileImg.src = this.user.photo_url;
        }

        const profileName = document.getElementById("profile-name");
        const profileIdTag = document.getElementById("profile-id-tag");
        if (profileName) profileName.innerText = this.user.first_name;
        if (profileIdTag) profileIdTag.innerText = `ID: ${this.user.telegram_id}`;

        if (this.user.ff_uid) {
            const profFfUid = document.getElementById("prof-ff-uid");
            const inputVerifyUid = document.getElementById("input-verify-uid");
            if (profFfUid) profFfUid.innerText = `FF UID: ${this.user.ff_uid}`;
            if (inputVerifyUid) inputVerifyUid.value = this.user.ff_uid;
        }
        if (this.user.whatsapp) {
            const profWa = document.getElementById("prof-wa");
            const inputVerifyWa = document.getElementById("input-verify-wa");
            if (profWa) profWa.innerText = `WhatsApp: ${this.user.whatsapp}`;
            if (inputVerifyWa) inputVerifyWa.value = this.user.whatsapp;
        }

        const badge = document.getElementById("unlock-badge");
        if (badge) {
            if (this.isUnlocked) {
                badge.className = "badge unlocked";
                badge.innerText = "UNLOCKED 24H";
            } else {
                badge.className = "badge locked";
                badge.innerText = "LOCKED";
            }
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

    navigate(viewId) {
        document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.add("active");
        if (viewId === "view-profile") this.loadMySquads();
    }

    async handleUserVerification() {
        const payload = {
            ff_uid: document.getElementById("input-verify-uid")?.value.trim(),
            whatsapp_number: document.getElementById("input-verify-wa")?.value.trim()
        };

        const res = await fetch(`${CONFIG.API_BASE}/user/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
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
            const res = await fetch(`${CONFIG.API_BASE}/tournaments`);
            const data = await res.json();
            container.innerHTML = "";
            window.tournamentCache = data.tournaments;

            const hostControls = document.getElementById("creator-active-controls");
            if (hostControls) hostControls.innerHTML = "";

            if (!data.tournaments || data.tournaments.length === 0) {
                container.innerHTML = `<div class="sub-text align-center">বর্তমানে কোনো টুর্নামেন্ট চালু নেই।</div>`;
                return;
            }

            data.tournaments.forEach(t => {
                const card = document.createElement("div");
                card.className = "glass-card tournament-item";
                card.innerHTML = `
                    <div class="tournament-header">
                        <span>${t.code} (${t.total_joined_players}/${t.max_players})</span>
                        <span style="color:var(--accent-orange); cursor:pointer;" onclick="app.openHostProfile(${t.creator_id})">Squad Host 🔗</span>
                    </div>
                    <div class="tournament-title">${t.title}</div>
                    <div class="tournament-meta">
                        <span>🏆 ${t.prize}</span> | <span>🕒 ${t.start_time}</span>
                    </div>
                    <button class="btn-action full-width margin-top" onclick="app.openTournamentDetail('${t.id}')">Join / View Details</button>
                `;
                container.appendChild(card);

                if ((this.role === "CREATOR" || this.role === "MAIN_ADMIN") && t.creator_id === this.user.telegram_id) {
                    if (hostControls) {
                        hostControls.innerHTML += `
                            <div class="player-box margin-top">
                                <h4>${t.title}</h4>
                                <p class="sub-text">Status: ${t.status}</p>
                                <button class="btn-action full-width margin-top" onclick="app.triggerStartMatch('${t.id}')">▶ Start Match (Auto Delete in 17m)</button>
                                <button class="btn-secondary full-width margin-top" onclick="app.deleteTournament('${t.id}')">🗑 Delete Tournament</button>
                            </div>
                        `;
                    }
                }
            });
        } catch (err) {
            container.innerHTML = `<div class="sub-text">Error loading tournaments.</div>`;
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
            card.innerHTML = `
                <h2>${t.title}</h2>
                <p><strong>Lobby Progress:</strong> ${t.total_joined_players}/${t.max_players} Players Joined</p>
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
                    <strong>${sq.squad_name}</strong> (Code: <code>${sq.squad_code}</code>)
                    <ul class="sub-text margin-top">${membersList}</ul>
                </div>
            `;
        });
    }

    async handleLeaderRegistration() {
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
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            this.startRedirectSequence(data.task_link, `🎉 Squad Registration Successful!\nSquad Code: ${data.squad_code}`);
        } else {
            alert(`⚠️ ${data.detail}`);
        }
    }

    async submitJoinSquad() {
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
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            this.startRedirectSequence(data.task_link, "✅ স্কোয়াডে জয়েন সম্পূর্ণ হয়েছে!");
        } else {
            alert(`⚠️ ${data.detail}`);
        }
    }

    startRedirectSequence(linkUrl, msgText) {
        const win = window.open(linkUrl, "_blank");
        if (!win) {
            window.location.href = linkUrl;
        }
        
        let sec = 7;
        const overlay = document.getElementById("redirect-countdown-overlay");
        const timerText = document.getElementById("redirect-timer-text");
        if (overlay) overlay.classList.remove("hidden");
        if (timerText) timerText.innerText = `সাব-এডমিনের লিংকে রিডাইরেক্ট হচ্ছে... ${sec} সেকেন্ড অপেক্ষা করুন`;

        clearInterval(this.redirectTimer);
        this.redirectTimer = setInterval(() => {
            sec--;
            if (timerText) timerText.innerText = `রেজিস্ট্রেশন কনফার্ম করা হচ্ছে... ${sec}s`;
            if (sec <= 0) {
                clearInterval(this.redirectTimer);
                if (overlay) overlay.classList.add("hidden");
                alert(msgText);
                this.loadTournaments();
                this.navigate("view-home");
            }
        }, 1000);
    }

    async loadMySquads() {
        const container = document.getElementById("my-squads-list");
        if (!container || !this.user) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/user/my-squads`, {
                headers: { "X-TG-ID": this.user.telegram_id.toString() }
            });
            const data = await res.json();
            container.innerHTML = "";
            if (!data.squads || data.squads.length === 0) {
                container.innerHTML = `<p class="sub-text">আপনার তৈরি কোনো সক্রিয় স্কোয়াড নেই।</p>`;
                return;
            }

            data.squads.forEach(sq => {
                let mList = sq.members.map(m => `<li>${m.nickname} (UID: ${m.ff_id})</li>`).join("");
                container.innerHTML += `
                    <div class="player-box margin-top">
                        <div><strong>${sq.squad_name}</strong></div>
                        <div class="sub-text">Code: <code>${sq.squad_code}</code></div>
                        <ul class="sub-text">${mList}</ul>
                        <button class="btn-secondary full-width margin-top" onclick="app.deleteMySquad('${sq.squad_code}')">❌ Delete Squad</button>
                    </div>
                `;
            });
        } catch (err) {
            container.innerHTML = `<p class="sub-text">Error loading squads.</p>`;
        }
    }

    async deleteMySquad(sqCode) {
        if (!confirm("আপনি কি নিশ্চিত আপনার স্কোয়াডটি ডিলিট করতে চান?")) return;
        const res = await fetch(`${CONFIG.API_BASE}/tournaments/squad/${sqCode}`, {
            method: "DELETE",
            headers: { "X-TG-ID": this.user.telegram_id.toString() }
        });
        if (res.ok) {
            alert("স্কোয়াড ডিলিট সফল হয়েছে!");
            this.loadMySquads();
            this.loadTournaments();
        }
    }

    async showAdAndUnlock() {
        if (typeof show_10253210 === 'function') {
            show_10253210().then(async () => {
                await this.verifyAdReward();
            }).catch(() => {
                alert("Ad failed to load. Please try again.");
            });
        } else {
            await this.verifyAdReward();
        }
    }

    async verifyAdReward() {
        const res = await fetch(`${CONFIG.API_BASE}/user/unlock-ad`, {
            method: "POST",
            headers: { "X-TG-ID": this.user.telegram_id.toString() }
        });
        if (res.ok) {
            this.isUnlocked = true;
            this.renderUIState();
            alert("🔓 Congratulations! 24-Hour Access Unlocked.");
        }
    }

    async triggerStartMatch(tId) {
        const res = await fetch(`${CONFIG.API_BASE}/tournaments/start-match`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
            body: JSON.stringify({ tournament_id: tId })
        });
        if (res.ok) {
            alert("▶ Match Started! Tournament will automatically delete in 17 minutes.");
            this.loadTournaments();
        }
    }

    async deleteTournament(tId) {
        if (!confirm("Are you sure you want to delete this tournament?")) return;
        await fetch(`${CONFIG.API_BASE}/tournaments/${tId}`, {
            method: "DELETE",
            headers: { "X-TG-ID": this.user.telegram_id.toString() }
        });
        this.loadTournaments();
    }

    async saveHostProfile(e) {
        e.preventDefault();
        const payload = {
            telegram_id: this.user.telegram_id,
            squad_name: document.getElementById("cp-squad-name")?.value,
            description: document.getElementById("cp-desc")?.value,
            player_roles: document.getElementById("cp-roles")?.value,
            youtube: document.getElementById("cp-yt")?.value,
            facebook: document.getElementById("cp-fb")?.value,
            tiktok: document.getElementById("cp-tk")?.value
        };

        const res = await fetch(`${CONFIG.API_BASE}/creator/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
            body: JSON.stringify(payload)
        });
        if (res.ok) alert("✅ Squad Host Profile Saved!");
    }

    async handleCreateTournament() {
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
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
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

    // Main Admin Control Logic
    async loadAdminData() {
        const res = await fetch(`${CONFIG.API_BASE}/admin/dashboard`, {
            headers: { "X-TG-ID": this.user.telegram_id.toString() }
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById("adm-total-users").innerText = data.total_users;
            document.getElementById("adm-total-tournaments").innerText = data.active_tournaments;
            document.getElementById("adm-total-ads").innerText = data.total_ad_views;

            window.allAdminUsers = data.users;
            window.allBannedUsers = data.banned_users;

            // Render Announcements
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

            // Render Sub-Admins
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
                        <div class="sub-text">TG ID: ${u.telegram_id} | FF UID: ${u.ff_uid || 'Not Set'}</div>
                        <div class="sub-text">WhatsApp: ${u.whatsapp || 'Not Set'}</div>
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

    async publishAnnouncement() {
        const text = document.getElementById("adm-popup-msg")?.value.trim();
        const img = document.getElementById("adm-popup-img")?.value.trim();
        if (!text) {
            alert("পপ-আপ এর টেক্সট মেসেজ লিখুন!");
            return;
        }

        await fetch(`${CONFIG.API_BASE}/admin/announcement/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
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
            headers: { "X-TG-ID": this.user.telegram_id.toString() }
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
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
            body: JSON.stringify(payload)
        });
        alert("✅ Sub-Admin added successfully!");
        this.loadAdminData();
    }

    async removeCreatorByAdmin(creatorId) {
        if (!confirm("Are you sure you want to remove this host role?")) return;
        await fetch(`${CONFIG.API_BASE}/admin/creators/${creatorId}`, {
            method: "DELETE",
            headers: { "X-TG-ID": this.user.telegram_id.toString() }
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
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
            body: JSON.stringify({ telegram_id: tgId })
        });
        this.loadAdminData();
    }

    async unbanUserByAdmin(tgId) {
        await fetch(`${CONFIG.API_BASE}/admin/users/unban`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-TG-ID": this.user.telegram_id.toString() },
            body: JSON.stringify({ telegram_id: tgId })
        });
        this.loadAdminData();
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.app = new MiniApp();
});
