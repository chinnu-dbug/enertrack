/**
 * EnerTrack Sound Alerts & Over-Consumption Audio Engine
 * Uses Web Audio API to synthesize alerts with explicit user permission.
 */
class EnerTrackAudioEngine {
    constructor() {
        this.ctx = null;
        this.isAllowed = localStorage.getItem('enertrack_audio_allowed') === 'true';
        this.thresholdKw = parseFloat(localStorage.getItem('enertrack_sound_threshold') || '2.0');
        this.lastAlarmTime = 0;
        this.alarmCooldownMs = 15000; // 15s between audible alarms
        this.hasPrompted = localStorage.getItem('enertrack_audio_prompted') === 'true';
        this.isSilencedForNow = false;

        this.initDOM();
        this.updateUI();
        this.startLivePolling();
    }

    initContext() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    initDOM() {
        // Navbar button
        const soundBtn = document.getElementById('soundAlertBtn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                if (!this.isAllowed) {
                    this.showPermissionModal();
                } else {
                    // Toggle off if already on
                    this.mute();
                }
            });
        }

        // Permission modal actions
        document.getElementById('btnAllowSound')?.addEventListener('click', () => {
            this.grantPermission();
        });

        document.getElementById('btnMuteSound')?.addEventListener('click', () => {
            this.denyPermission();
        });

        document.getElementById('btnTestChime')?.addEventListener('click', () => {
            this.initContext();
            this.playTestChime();
        });

        // Threshold chips selection inside modal
        document.querySelectorAll('.threshold-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.threshold-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const val = parseFloat(chip.getAttribute('data-val') || '2.0');
                this.setThreshold(val);
            });
        });

        // Silence button on floating alert
        document.getElementById('btnSilenceFloatingAlert')?.addEventListener('click', () => {
            this.isSilencedForNow = true;
            this.hideFloatingAlert();
            this.showToast('Audio alarm silenced for current spike session.', 'info');
        });

        // First-visit auto-prompt: if never prompted, show modal once after 2.5s
        if (!this.hasPrompted && !this.isAllowed) {
            setTimeout(() => {
                if (!this.hasPrompted) {
                    this.showPermissionModal();
                }
            }, 2500);
        }
    }

    showPermissionModal() {
        this.hasPrompted = true;
        localStorage.setItem('enertrack_audio_prompted', 'true');
        const modal = document.getElementById('soundModalOverlay');
        if (modal) modal.classList.add('active');
    }

    hidePermissionModal() {
        const modal = document.getElementById('soundModalOverlay');
        if (modal) modal.classList.remove('active');
    }

    grantPermission() {
        this.initContext();
        this.isAllowed = true;
        localStorage.setItem('enertrack_audio_allowed', 'true');
        localStorage.setItem('enertrack_audio_prompted', 'true');
        this.hidePermissionModal();
        this.playTestChime();
        this.updateUI();
        this.showToast(`🔊 Sound alerts enabled! You will be alerted when power exceeds ${this.thresholdKw.toFixed(1)} kW.`, 'success');
    }

    denyPermission() {
        this.isAllowed = false;
        localStorage.setItem('enertrack_audio_allowed', 'false');
        localStorage.setItem('enertrack_audio_prompted', 'true');
        this.hidePermissionModal();
        this.updateUI();
        this.showToast('🔇 Sound alerts muted. You can enable them anytime from the top navbar.', 'info');
    }

    mute() {
        this.isAllowed = false;
        localStorage.setItem('enertrack_audio_allowed', 'false');
        this.isSilencedForNow = true;
        this.hideFloatingAlert();
        this.updateUI();
        this.showToast('🔇 Sound alerts disabled.', 'info');
    }

    setThreshold(kw) {
        this.thresholdKw = kw;
        localStorage.setItem('enertrack_sound_threshold', kw.toString());
        const display = document.getElementById('modalThresholdDisplay');
        if (display) display.innerText = `${kw.toFixed(1)} kW`;
    }

    updateUI() {
        const btn = document.getElementById('soundAlertBtn');
        const icon = document.getElementById('soundIcon');
        const label = document.getElementById('soundLabel');

        if (!btn || !icon || !label) return;

        if (this.isAllowed) {
            btn.className = 'sound-toggle-btn sound-active';
            btn.title = `Sound Alerts Active (> ${this.thresholdKw.toFixed(1)} kW). Click to Mute.`;
            icon.className = 'fa-solid fa-volume-high';
            label.innerHTML = `<span>Sound On</span> <span class="audio-waves"><span></span><span></span><span></span></span>`;
        } else {
            btn.className = 'sound-toggle-btn';
            btn.title = 'Sound Alerts Muted. Click to Enable.';
            icon.className = 'fa-solid fa-volume-xmark';
            label.innerHTML = '<span>Sound Off</span>';
        }

        // Highlight selected chip in modal
        document.querySelectorAll('.threshold-chip').forEach(chip => {
            const val = parseFloat(chip.getAttribute('data-val') || '2.0');
            if (val === this.thresholdKw) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        const display = document.getElementById('modalThresholdDisplay');
        if (display) display.innerText = `${this.thresholdKw.toFixed(1)} kW`;
    }

    /**
     * Pleasant double chime to test and confirm audio permission
     */
    playTestChime() {
        try {
            this.initContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880.00, now + 0.14); // A5

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.start(now);
            osc.stop(now + 0.45);
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    }

    /**
     * Synthesized industrial pulsing alarm for high electricity over-consumption
     */
    playAlarmSound() {
        if (!this.isAllowed || this.isSilencedForNow) return;

        const nowMs = Date.now();
        if (nowMs - this.lastAlarmTime < this.alarmCooldownMs) return;
        this.lastAlarmTime = nowMs;

        try {
            this.initContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            // Pulse 3 repeating alert beeps
            [0.0, 0.22, 0.44].forEach((offset) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(920, now + offset);
                osc.frequency.exponentialRampToValueAtTime(460, now + offset + 0.16);

                gain.gain.setValueAtTime(0.28, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.19);

                osc.start(now + offset);
                osc.stop(now + offset + 0.19);
            });
        } catch (e) {
            console.warn('Alarm sound failed:', e);
        }
    }

    checkReading(powerKw) {
        const p = parseFloat(powerKw);
        if (isNaN(p)) return;

        const isOver = (p >= this.thresholdKw);

        if (isOver) {
            // Trigger audible alarm sound
            this.playAlarmSound();

            // Visual indicator on navbar button
            const btn = document.getElementById('soundAlertBtn');
            if (btn && this.isAllowed) {
                btn.classList.add('sound-alarm-active');
            }

            // Show floating over-consumption banner
            if (!this.isSilencedForNow) {
                this.showFloatingAlert(p);
            }
        } else {
            // Normal level
            this.isSilencedForNow = false;
            this.hideFloatingAlert();
            const btn = document.getElementById('soundAlertBtn');
            if (btn) btn.classList.remove('sound-alarm-active');
        }
    }

    showFloatingAlert(powerKw) {
        const el = document.getElementById('floatingOverconsumptionAlert');
        const valEl = document.getElementById('floatingAlertPowerVal');
        const threshEl = document.getElementById('floatingAlertThreshVal');

        if (valEl) valEl.innerText = `${powerKw.toFixed(2)} kW`;
        if (threshEl) threshEl.innerText = `${this.thresholdKw.toFixed(1)} kW`;
        if (el) el.classList.add('active');
    }

    hideFloatingAlert() {
        const el = document.getElementById('floatingOverconsumptionAlert');
        if (el) el.classList.remove('active');
    }

    startLivePolling() {
        // Poll /api/live every 4 seconds
        setInterval(() => {
            fetch('/api/live')
                .then(r => r.json())
                .then(res => {
                    if (res.status === 'success' && res.meter_data) {
                        const p = res.meter_data.power_kw;
                        this.checkReading(p);

                        // Navbar live ticker update
                        const navPower = document.getElementById('navPowerVal');
                        if (navPower) {
                            navPower.innerText = `${p.toFixed(2)} kW`;
                            const ticker = document.getElementById('navbarLiveTicker');
                            if (ticker) {
                                if (p >= this.thresholdKw) {
                                    ticker.style.background = '#fee2e2';
                                    ticker.style.color = '#dc2626';
                                } else {
                                    ticker.style.background = '';
                                    ticker.style.color = '';
                                }
                            }
                        }
                    }
                })
                .catch(() => {});
        }, 4000);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'danger' ? 'border-danger' : ''}`;
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-success' : 'fa-circle-info text-primary'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
}

// Global instance
document.addEventListener('DOMContentLoaded', () => {
    window.enerTrackAudio = new EnerTrackAudioEngine();
    window.checkPowerConsumption = (p) => window.enerTrackAudio.checkReading(p);
});
