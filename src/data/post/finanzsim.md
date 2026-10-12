---
publishDate: 2026-01-01T00:00:00Z
title: "Meet FinanzSim: An Educational Financial Management Simulator"
excerpt: "An interactive financial management simulator for first-year business students, with AI-generated feedback after each simulated year."
image: "~/assets/images/blog/finanzsim/finanzsim2026_01.png"
imageAlt: "Meet FinanzSim: An Educational Financial Management Simulator"
category: "Educación"
tags:
  - "educación"
  - "investigación"
---

![Meet FinanzSim: An Educational Financial Management Simulator](../../assets/images/blog/finanzsim/finanzsim2026_01.png)

## Overview

FinanzSim is an interactive web-based financial management simulator designed for first-year business students. It functions as a sandbox where students can safely experiment with financial strategies, learn from their mistakes, and receive instant AI-generated feedback.

## Core Objectives

The project aims to achieve five primary goals:

1. Connect theoretical knowledge with practical application through hands-on exploration
2. Build strategic thinking by demonstrating how business decisions interconnect across financial systems
3. Deliver personalized, real-time AI analysis after each simulation year
4. Make complex financial metrics (ROA, ROE, liquidity ratios) more accessible and understandable
5. Create a consequence-free learning environment encouraging experimentation

## How It Operates

**Setup Phase:**

- Students select simulation duration (1-12 years)
- Companies begin with €100,000 in initial capital

**Annual Decisions:**

Students manage eight key variables annually: units sold, unit pricing, variable costs, fixed costs, new investments, loan financing, equity injections, and payment timing metrics.

**Analysis Delivered:**

The platform generates comprehensive financial statements, break-even analyses, key performance ratios, cash flow projections, and working capital cycle calculations after each year.

**AI Enhancement:**

An AI professor component provides performance commentary, risk identification, improvement suggestions, and benchmark comparisons. A final executive report includes NPV calculations and strategic recommendations.

## Technical Architecture

**Frontend:** React 19, TypeScript, Recharts visualization, and Vite build tool

**Backend & AI:** Cloudflare Workers for serverless computing, Cloudflare Pages for deployment, and Google Gemini API for financial analysis generation

## Background

FinanzSim emerged as a collaborative research project with Spain's University of Alcalá Faculty of Economics, Business and Tourism, exploring how AI-enhanced simulations can improve financial literacy among university students.

**Disclaimer:** The application is educational and non-commercial; AI-generated analyses are informational only and don't constitute professional financial advice.


## También te puede interesar

- [Building a Global AI-in-Education Observatory with Manus](/blog/ai-education-observatory)
- [Can AI Pass Spain's Toughest Medical Exam?](/blog/2025-04-19-can-ai-pass-spain-medical-exam)
