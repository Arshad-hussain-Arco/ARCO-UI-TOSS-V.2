import { useCallback, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import gsap from 'gsap';

import logoUrl from '@assets/images/logo.png';
import { APP_NAME } from '@constants/app';
import { ROUTES } from '@constants/routes';
import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';

import './Login.css';

/**
 * Sign-in screen. Rebuilt as an asymmetrical editorial landing page
 * featuring ultra-subtle 3D card parallax and GSAP cinematic reveals.
 */
export function LoginPage() {
  useDocumentTitle('Sign in');

  const { login, isSubmitting, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const cardRef = useRef(null);
  const pageRef = useRef(null);

  // Cinematic GSAP Initial Load Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // 1. Logo: Fade in and drop down slightly
      tl.fromTo(
        '.login-logo-fixed',
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out' },
      );

      // 2. TOSS Accent: Fade in and slide right
      tl.fromTo(
        '.brand-accent',
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 1, ease: 'power3.out' },
        '-=0.8',
      );

      // 3. Massive Title Reveal (Desktop only)
      const isMobile = window.matchMedia('(max-width: 1024px)').matches;
      if (!isMobile) {
        tl.fromTo(
          '.brand-title-reveal-line',
          { y: '100%' },
          { y: '0%', duration: 1.2, stagger: 0.15, ease: 'expo.out' },
          '-=0.8',
        );
      }

      // 4. Login Card: Slide in from bottom and fade in
      tl.fromTo(
        cardRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.5, ease: 'power4.out' },
        '-=1.0',
      );
    }, pageRef);

    return () => ctx.revert();
  }, []);

  // Premium 3D Mouse Parallax on the login card
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e) => {
      // Disable parallax entirely on mobile, tablets, or touch devices
      const isTouchOrMobile =
        window.matchMedia('(max-width: 1024px)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;

      if (isTouchOrMobile) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Ultra-subtle tilt: divide by 280
      const rotateX = -y / 280;
      const rotateY = x / 280;

      gsap.to(card, {
        rotateX,
        rotateY,
        transformPerspective: 1500,
        ease: 'power2.out',
        duration: 0.4,
      });
    };

    const handleMouseLeave = () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        ease: 'power2.out',
        duration: 0.4,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleChange = useCallback(
    (field) => (event) => {
      const { value } = event.target;
      setCredentials((current) => ({ ...current, [field]: value }));
      clearError();
    },
    [clearError],
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      try {
        await login(credentials);
        navigate(location.state?.from?.pathname ?? ROUTES.DASHBOARD, { replace: true });
      } catch {
        // The failure message is surfaced through AuthContext's `error`.
      }
    },
    [login, credentials, navigate, location.state],
  );

  return (
    <div ref={pageRef} className="login-page">
      {/* Left Column - Editorial Brand Layer */}
      <div className="login-left-brand">
        {/* SNB logo rendered inside left column for layout alignment */}
        <div className="login-logo-fixed">
          <img src={logoUrl} alt={APP_NAME} className="login-logo-img" />
        </div>

        <div className="brand-accent">
          <span className="brand-accent-text">TOSS</span>
        </div>

        <div className="brand-title-reveal-wrapper">
          <h1 className="brand-title-reveal-line">
            Treasu<span className="ry-fix">ry</span> IT
          </h1>
        </div>
        <div className="brand-title-reveal-wrapper">
          <h1 className="brand-title-reveal-line">One Stop Store</h1>
        </div>
      </div>

      {/* Right Column - Glassmorphism Login Card Container */}
      <div className="login-right-form">
        <div className="login-card-parallax-container">
          <div ref={cardRef} className="login-card">
            <h2 className="login-form-title">Sign in</h2>

            <form onSubmit={handleSubmit} className="login-form" noValidate>
              <div className="login-form-group">
                <div className="login-input-wrapper">
                  <div className="login-input-icon">
                    <User className="login-icon" aria-hidden="true" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={credentials.username}
                    onChange={handleChange('username')}
                    placeholder=" "
                    className="login-input"
                    aria-invalid={Boolean(error) || undefined}
                  />
                  <label htmlFor="username" className="login-form-label">
                    Username
                  </label>
                </div>
              </div>

              <div className="login-form-group">
                <div className="login-input-wrapper">
                  <div className="login-input-icon">
                    <Lock className="login-icon" aria-hidden="true" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={credentials.password}
                    onChange={handleChange('password')}
                    placeholder=" "
                    className="login-input login-input-password"
                    aria-invalid={Boolean(error) || undefined}
                  />
                  <label htmlFor="password" className="login-form-label">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="login-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="login-icon" aria-hidden="true" />
                    ) : (
                      <Eye className="login-icon" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="login-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="login-button" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Version Info */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '24px',
          fontSize: '11px',
          color: 'var(--text-tertiary, #999999)',
          zIndex: 10,
        }}
      >
        Version 2.0.0
      </div>
    </div>
  );
}

export default LoginPage;
