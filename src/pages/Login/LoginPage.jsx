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

      // 1. Logo: Fade in and drop down
      tl.fromTo(
        '.login-logo-fixed',
        { y: -16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }
      );

      // 2. TOSS Accent: Fade in and slide in from right
      tl.fromTo(
        '.brand-accent',
        { x: 16, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
        '-=0.6'
      );

      // 3. Title lines: reveal upward from clip (expo out)
      tl.fromTo(
        '.brand-title-reveal-line',
        { y: '100%' },
        { y: '0%', duration: 1.2, stagger: 0.15, ease: 'expo.out' },
        '-=0.6'
      );

      // 4. Login Card: Slide in from right and fade in
      tl.fromTo(
        cardRef.current,
        { x: 24, opacity: 0 },
        { x: 0, opacity: 1, duration: 1.2, ease: 'power4.out' },
        '-=0.8'
      );

      // 5. Version text fade
      tl.fromTo(
        '.login-version',
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' },
        '-=0.4'
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
    [clearError]
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
    [login, credentials, navigate, location.state]
  );

  return (
    <div ref={pageRef} className="login-page">

      {/* Right Panel — Logo → Brand → Form → Version (all right-aligned) */}
      <div className="login-right-panel">

        {/* 1. Logo */}
        <div className="login-logo-fixed">
          <img src={logoUrl} alt={APP_NAME} className="login-logo-img" />
        </div>

        {/* 2. Brand accent */}
        <div className="brand-accent">
          <span className="brand-accent-text">TOSS</span>
          <div className="brand-accent-line" />
        </div>

        {/* 3. Title reveal */}
        <div className="brand-title-reveal-wrapper">
          <h1 className="brand-title-reveal-line">Treasury IT</h1>
        </div>
        <div className="brand-title-reveal-wrapper">
          <h1 className="brand-title-reveal-line">One Stop Store</h1>
        </div>

        {/* 4. Login Card */}
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

      {/* Version — absolute bottom of page */}
      <p className="login-version">Version 2.0.0</p>

    </div>
  );
}

export default LoginPage;
