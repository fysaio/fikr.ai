'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthFrame } from '@/components/fk';
import { useApp } from '@/context/AppContext';
import { PRODUCT_NAME } from '@/config/flags';
import { trackAuthEvent } from '@/lib/telemetry/events';
import '@/app/auth.css';
import './welcome.css';

export default function WelcomePage() {
  const router = useRouter();
  const { state } = useApp();

  useEffect(() => {
    trackAuthEvent('welcome_viewed');
    const isDone =
      typeof window !== 'undefined' &&
      localStorage.getItem('fikr_onboarding_done') === 'true';
    if (state.name && isDone) {
      router.replace('/today');
    }
  }, [state.name, router]);

  const brandLetter = PRODUCT_NAME.charAt(0).toLowerCase();

  return (
    <AuthFrame>
      <div className="auth-screen welcome-screen">
        {/* Header */}
        <header className="auth-header welcome-header">
          <div className="auth-brand welcome-brand">
            <div className="auth-logo welcome-logo" aria-hidden="true">
              {brandLetter}
            </div>
            <div className="auth-brand-text welcome-brand-text">
              <div className="auth-wordmark welcome-wordmark">{PRODUCT_NAME.toLowerCase()}</div>
              <div className="auth-byline welcome-byline">by Common Intelligence Labs</div>
            </div>
          </div>
          <Link href="/login" className="auth-link welcome-login-link">
            Log in
          </Link>
        </header>

        {/* Headline & Body Text */}
        <div className="welcome-hero">
          <h1 className="auth-headline welcome-headline">
            Your day,
            <br />
            <span className="auth-highlight welcome-headline-highlight">understood.</span>
          </h1>
          <p className="auth-body-text welcome-body-text">
            Say what&apos;s on your mind. I&apos;ll learn the rest, and only speak up when it helps.
          </p>
        </div>

        {/* Primary Call to Action & Trust Line */}
        <div className="welcome-cta">
          <button
            type="button"
            onClick={() => router.push('/you')}
            className="auth-btn auth-btn-primary welcome-btn"
          >
            Get started
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="welcome-btn-arrow"
            >
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
          <div className="welcome-trust-line">
            Everything I remember, you can see and change.
          </div>
        </div>

        {/* Card Cluster Section (Vertically Centered in remaining space) */}
        <div className="welcome-cluster-section">
          <div className="welcome-card-cluster" aria-hidden="true">
            {/* Back Card (Tilted -3deg) */}
            <div className="welcome-card-back">
              <div className="welcome-card-back-meta">In 25 min · 10:15</div>
              <div className="welcome-card-back-title">
                Research proposal: write the intro
              </div>
              <div className="welcome-card-back-sub">
                Due Friday. Not started yet.
              </div>
            </div>

            {/* Front Card */}
            <div className="welcome-card-front">
              <div className="welcome-card-front-meta">12:00 · Relationship</div>
              <div className="welcome-card-front-title">
                You said you&apos;d reply to Aisha.
              </div>
              <div className="welcome-card-front-why">
                <span className="welcome-why-label">Why:</span> you promised after
                Monday&apos;s meeting.
              </div>
            </div>

            {/* Overlapping "Remembered" Pill Chip */}
            <div className="welcome-chip">
              <div className="welcome-chip-circle">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="welcome-chip-check-icon"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </div>
              <div className="welcome-chip-text">
                <div className="welcome-chip-title">Remembered</div>
                <div className="welcome-chip-names">Aisha · Zara</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}
