import React from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceSettings from '@/components/VoiceSettings';

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#111118] to-[#0a0a0f] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-white/50 text-sm mt-1">
              Configure ATLAS console preferences
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            ← Back to Console
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-4 text-white/80">
              Voice & Audio
            </h2>
            <VoiceSettings />
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4 text-white/80">
              Dashboard Layout
            </h2>
            <button
              onClick={() => navigate('/settings/layout')}
              className="w-full p-4 border rounded-lg transition-colors hover:bg-white/5"
              style={{
                backgroundColor: 'var(--atlas-bg-card)',
                borderColor: 'var(--atlas-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-sm font-semibold" style={{ color: 'var(--atlas-text-primary)' }}>
                    Customize Dashboard Layout
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--atlas-text-secondary)' }}>
                    Arrange cards, add rows, and configure your dashboard
                  </div>
                </div>
                <svg className="w-5 h-5" style={{ color: 'var(--atlas-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4 text-white/80">
              Appearance
            </h2>
            <div
              className="p-4 border rounded-lg"
              style={{
                backgroundColor: 'var(--atlas-bg-card)',
                borderColor: 'var(--atlas-border)',
              }}
            >
              <div className="text-sm" style={{ color: 'var(--atlas-text-secondary)' }}>
                Theme customization coming soon
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-white/30 text-xs text-center">
            ATLAS Console Settings • Changes are saved automatically
          </p>
        </div>
      </div>
    </div>
  );
}
