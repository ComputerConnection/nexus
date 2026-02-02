import {
  Shield,
  Rocket,
  Globe,
  Terminal,
  Package,
  BookOpen,
  Smartphone,
  Database,
  Cloud,
  Boxes,
  type LucideIcon,
} from 'lucide-react';

// Template variable types for customization
export interface TemplateVariable {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'select' | 'multiselect' | 'boolean' | 'number';
  default: string | boolean | number | string[];
  options?: { value: string; label: string; description?: string }[];
  required?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    message?: string;
  };
  dependsOn?: { variable: string; value: string | boolean };
}

export interface TemplateOptionGroup {
  id: string;
  name: string;
  description: string;
  icon?: string;
  variables: TemplateVariable[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: LucideIcon;
  color: string;
  category: TemplateCategory;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedSetupTime: string;
  techStack: TechStackItem[];
  folderStructure: FolderItem[];
  setupTasks: SetupTask[];
  recommendedAgents: RecommendedAgent[];
  suggestedWorkflows: SuggestedWorkflow[];
  features: string[];
  prerequisites: string[];
  successCriteria: string[];
  // Customization options
  optionGroups?: TemplateOptionGroup[];
  quickCreate?: {
    enabled: boolean;
    defaults: Record<string, string | boolean | number | string[]>;
  };
}

export interface TechStackItem {
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'testing' | 'other';
  optional?: boolean;
}

export interface FolderItem {
  name: string;
  type: 'folder' | 'file';
  description?: string;
  children?: FolderItem[];
}

export interface SetupTask {
  id: string;
  title: string;
  description: string;
  agentRole: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
  dependencies?: string[];
  commands?: string[];
}

export interface RecommendedAgent {
  role: string;
  name: string;
  description: string;
  systemPrompt: string;
  priority: number;
}

export interface SuggestedWorkflow {
  id: string;
  name: string;
  description: string;
  steps: string[];
}

export type TemplateCategory =
  | 'web'
  | 'api'
  | 'mobile'
  | 'cli'
  | 'library'
  | 'devops'
  | 'data'
  | 'security'
  | 'documentation';

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { name: string; description: string }> = {
  web: { name: 'Web Applications', description: 'Frontend and full-stack web projects' },
  api: { name: 'API & Backend', description: 'REST APIs, GraphQL, microservices' },
  mobile: { name: 'Mobile Apps', description: 'iOS, Android, and cross-platform apps' },
  cli: { name: 'CLI Tools', description: 'Command-line applications and scripts' },
  library: { name: 'Libraries & Packages', description: 'Reusable code libraries and npm packages' },
  devops: { name: 'DevOps & Infrastructure', description: 'CI/CD, containers, cloud infrastructure' },
  data: { name: 'Data & ML', description: 'Data pipelines, analytics, machine learning' },
  security: { name: 'Security', description: 'Security audits, penetration testing' },
  documentation: { name: 'Documentation', description: 'Technical docs, API references, guides' },
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // ============================================================================
  // FULL-STACK WEB APPLICATION
  // ============================================================================
  {
    id: 'fullstack-web-app',
    name: 'Full-Stack Web Application',
    description: 'Complete web application with React frontend, Node.js backend, and database',
    longDescription: `A production-ready full-stack web application template featuring a modern React frontend with TypeScript, a robust Node.js/Express backend with RESTful API design, PostgreSQL database with proper migrations, authentication system, and comprehensive testing setup. Includes Docker configuration for easy deployment and CI/CD pipeline setup.`,
    icon: Globe,
    color: 'from-blue-500 to-cyan-500',
    category: 'web',
    tags: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'Full-Stack'],
    difficulty: 'intermediate',
    estimatedSetupTime: '2-3 hours',
    techStack: [
      { name: 'React 18', category: 'frontend' },
      { name: 'TypeScript', category: 'frontend' },
      { name: 'Tailwind CSS', category: 'frontend' },
      { name: 'React Query', category: 'frontend' },
      { name: 'React Router', category: 'frontend' },
      { name: 'Node.js', category: 'backend' },
      { name: 'Express', category: 'backend' },
      { name: 'PostgreSQL', category: 'database' },
      { name: 'Prisma ORM', category: 'database' },
      { name: 'Redis', category: 'database', optional: true },
      { name: 'Docker', category: 'devops' },
      { name: 'Jest', category: 'testing' },
      { name: 'Playwright', category: 'testing' },
    ],
    folderStructure: [
      {
        name: 'frontend',
        type: 'folder',
        description: 'React frontend application',
        children: [
          { name: 'src', type: 'folder', children: [
            { name: 'components', type: 'folder', description: 'Reusable UI components' },
            { name: 'pages', type: 'folder', description: 'Page components' },
            { name: 'hooks', type: 'folder', description: 'Custom React hooks' },
            { name: 'services', type: 'folder', description: 'API service functions' },
            { name: 'stores', type: 'folder', description: 'State management' },
            { name: 'types', type: 'folder', description: 'TypeScript type definitions' },
            { name: 'utils', type: 'folder', description: 'Utility functions' },
            { name: 'App.tsx', type: 'file' },
            { name: 'main.tsx', type: 'file' },
          ]},
          { name: 'public', type: 'folder' },
          { name: 'package.json', type: 'file' },
          { name: 'vite.config.ts', type: 'file' },
          { name: 'tailwind.config.js', type: 'file' },
        ],
      },
      {
        name: 'backend',
        type: 'folder',
        description: 'Node.js backend API',
        children: [
          { name: 'src', type: 'folder', children: [
            { name: 'controllers', type: 'folder', description: 'Request handlers' },
            { name: 'middleware', type: 'folder', description: 'Express middleware' },
            { name: 'models', type: 'folder', description: 'Database models' },
            { name: 'routes', type: 'folder', description: 'API route definitions' },
            { name: 'services', type: 'folder', description: 'Business logic' },
            { name: 'utils', type: 'folder', description: 'Utility functions' },
            { name: 'config', type: 'folder', description: 'Configuration files' },
            { name: 'app.ts', type: 'file' },
            { name: 'server.ts', type: 'file' },
          ]},
          { name: 'prisma', type: 'folder', children: [
            { name: 'schema.prisma', type: 'file', description: 'Database schema' },
            { name: 'migrations', type: 'folder' },
          ]},
          { name: 'tests', type: 'folder' },
          { name: 'package.json', type: 'file' },
        ],
      },
      { name: 'docker-compose.yml', type: 'file', description: 'Docker composition' },
      { name: 'Dockerfile.frontend', type: 'file' },
      { name: 'Dockerfile.backend', type: 'file' },
      { name: '.github', type: 'folder', children: [
        { name: 'workflows', type: 'folder', children: [
          { name: 'ci.yml', type: 'file', description: 'CI/CD pipeline' },
        ]},
      ]},
      { name: 'README.md', type: 'file' },
      { name: '.env.example', type: 'file' },
    ],
    setupTasks: [
      {
        id: 'design-architecture',
        title: 'Design System Architecture',
        description: 'Create detailed architecture diagrams, define API contracts, database schema, and component hierarchy. Document key design decisions and trade-offs.',
        agentRole: 'architect',
        priority: 'high',
        estimatedTime: '30 min',
      },
      {
        id: 'setup-frontend',
        title: 'Initialize Frontend Project',
        description: 'Create React app with Vite, configure TypeScript, set up Tailwind CSS, install dependencies, configure path aliases and ESLint.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '20 min',
        dependencies: ['design-architecture'],
        commands: [
          'npm create vite@latest frontend -- --template react-ts',
          'cd frontend && npm install',
          'npm install -D tailwindcss postcss autoprefixer',
          'npx tailwindcss init -p',
        ],
      },
      {
        id: 'setup-backend',
        title: 'Initialize Backend Project',
        description: 'Create Express server with TypeScript, configure Prisma ORM, set up authentication middleware, implement error handling.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '25 min',
        dependencies: ['design-architecture'],
        commands: [
          'mkdir backend && cd backend && npm init -y',
          'npm install express cors helmet dotenv',
          'npm install -D typescript @types/node @types/express ts-node nodemon',
          'npm install prisma @prisma/client',
          'npx prisma init',
        ],
      },
      {
        id: 'setup-database',
        title: 'Configure Database Schema',
        description: 'Design and implement database schema with Prisma, create initial migrations, set up seed data for development.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '20 min',
        dependencies: ['setup-backend'],
      },
      {
        id: 'implement-auth',
        title: 'Implement Authentication',
        description: 'Build JWT-based authentication system with login, registration, password reset, and session management.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '45 min',
        dependencies: ['setup-database'],
      },
      {
        id: 'create-api-routes',
        title: 'Create API Routes',
        description: 'Implement RESTful API endpoints for all resources, add input validation, implement pagination and filtering.',
        agentRole: 'implementer',
        priority: 'medium',
        estimatedTime: '40 min',
        dependencies: ['implement-auth'],
      },
      {
        id: 'build-ui-components',
        title: 'Build UI Component Library',
        description: 'Create reusable UI components: buttons, inputs, cards, modals, navigation, forms with proper accessibility.',
        agentRole: 'implementer',
        priority: 'medium',
        estimatedTime: '35 min',
        dependencies: ['setup-frontend'],
      },
      {
        id: 'integrate-frontend-backend',
        title: 'Frontend-Backend Integration',
        description: 'Connect frontend to API, implement React Query for data fetching, add loading states and error handling.',
        agentRole: 'implementer',
        priority: 'medium',
        estimatedTime: '30 min',
        dependencies: ['create-api-routes', 'build-ui-components'],
      },
      {
        id: 'write-tests',
        title: 'Write Test Suites',
        description: 'Create unit tests for backend services, integration tests for API, and E2E tests for critical user flows.',
        agentRole: 'tester',
        priority: 'medium',
        estimatedTime: '45 min',
        dependencies: ['integrate-frontend-backend'],
      },
      {
        id: 'security-review',
        title: 'Security Audit',
        description: 'Review authentication implementation, check for OWASP Top 10 vulnerabilities, validate input sanitization.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '30 min',
        dependencies: ['implement-auth', 'create-api-routes'],
      },
      {
        id: 'setup-docker',
        title: 'Configure Docker & CI/CD',
        description: 'Create Dockerfiles, docker-compose for local development, and GitHub Actions workflow for CI/CD.',
        agentRole: 'devops',
        priority: 'medium',
        estimatedTime: '25 min',
        dependencies: ['integrate-frontend-backend'],
      },
      {
        id: 'write-documentation',
        title: 'Create Documentation',
        description: 'Write README with setup instructions, API documentation, architecture overview, and contribution guidelines.',
        agentRole: 'documenter',
        priority: 'low',
        estimatedTime: '20 min',
        dependencies: ['setup-docker'],
      },
    ],
    recommendedAgents: [
      {
        role: 'architect',
        name: 'System Architect',
        description: 'Designs overall system architecture and makes technical decisions',
        systemPrompt: `You are an expert software architect specializing in full-stack web applications. Your responsibilities include:
- Designing scalable, maintainable system architectures
- Defining API contracts and database schemas
- Making technology choices and justifying trade-offs
- Creating architecture diagrams and documentation
- Reviewing code for architectural consistency
Focus on clean architecture principles, separation of concerns, and future scalability.`,
        priority: 1,
      },
      {
        role: 'implementer',
        name: 'Full-Stack Developer',
        description: 'Implements features across frontend and backend',
        systemPrompt: `You are an expert full-stack developer proficient in React, TypeScript, Node.js, and PostgreSQL. Your responsibilities include:
- Writing clean, maintainable, well-documented code
- Implementing features according to specifications
- Following best practices for both frontend and backend
- Handling edge cases and error scenarios
- Writing self-documenting code with clear naming conventions
Always consider performance, accessibility, and user experience.`,
        priority: 2,
      },
      {
        role: 'tester',
        name: 'QA Engineer',
        description: 'Writes and maintains test suites',
        systemPrompt: `You are an expert QA engineer specializing in web application testing. Your responsibilities include:
- Writing comprehensive unit tests with high coverage
- Creating integration tests for API endpoints
- Implementing E2E tests for critical user journeys
- Setting up test fixtures and mocks
- Identifying edge cases and potential failure scenarios
Focus on testing both happy paths and error conditions.`,
        priority: 3,
      },
      {
        role: 'security',
        name: 'Security Analyst',
        description: 'Reviews code for security vulnerabilities',
        systemPrompt: `You are a security expert specializing in web application security. Your responsibilities include:
- Auditing authentication and authorization implementations
- Identifying OWASP Top 10 vulnerabilities
- Reviewing input validation and sanitization
- Checking for SQL injection, XSS, CSRF vulnerabilities
- Recommending security best practices
Provide specific, actionable security recommendations.`,
        priority: 4,
      },
      {
        role: 'devops',
        name: 'DevOps Engineer',
        description: 'Sets up CI/CD and infrastructure',
        systemPrompt: `You are a DevOps engineer expert in containerization and CI/CD. Your responsibilities include:
- Creating optimized Dockerfiles for production
- Setting up docker-compose for local development
- Configuring GitHub Actions CI/CD pipelines
- Implementing proper environment variable management
- Setting up monitoring and logging
Focus on reproducible builds and efficient deployments.`,
        priority: 5,
      },
    ],
    suggestedWorkflows: [
      {
        id: 'feature-development',
        name: 'New Feature Development',
        description: 'Complete workflow for implementing a new feature',
        steps: [
          'Architect designs feature specification',
          'Implementer creates database migrations',
          'Implementer builds backend API',
          'Implementer creates frontend components',
          'Tester writes test cases',
          'Security reviews implementation',
          'Documenter updates API docs',
        ],
      },
      {
        id: 'bug-fix',
        name: 'Bug Fix Workflow',
        description: 'Systematic approach to fixing bugs',
        steps: [
          'Architect analyzes bug and identifies root cause',
          'Implementer creates failing test',
          'Implementer fixes the bug',
          'Tester verifies fix and adds regression tests',
          'Security checks for related vulnerabilities',
        ],
      },
    ],
    features: [
      'User authentication with JWT tokens',
      'Role-based access control',
      'RESTful API with OpenAPI documentation',
      'Database migrations and seeding',
      'Form validation on frontend and backend',
      'Error handling and logging',
      'Responsive UI with dark mode',
      'Docker containerization',
      'CI/CD pipeline with GitHub Actions',
      'Comprehensive test coverage',
    ],
    prerequisites: [
      'Node.js 18+ installed',
      'PostgreSQL database (or Docker)',
      'Basic understanding of React and TypeScript',
      'Git for version control',
    ],
    successCriteria: [
      'All tests passing with 80%+ coverage',
      'No critical security vulnerabilities',
      'API response times under 200ms',
      'Lighthouse score above 90',
      'Successfully deployed to staging environment',
    ],
    optionGroups: [
      {
        id: 'project-info',
        name: 'Project Information',
        description: 'Basic project details',
        variables: [
          {
            id: 'projectName',
            name: 'Project Name',
            description: 'The name of your project (lowercase, no spaces)',
            type: 'text',
            default: 'my-app',
            required: true,
            validation: { pattern: '^[a-z][a-z0-9-]*$', message: 'Must be lowercase with hyphens only' },
          },
          {
            id: 'description',
            name: 'Description',
            description: 'Brief project description',
            type: 'text',
            default: 'A full-stack web application',
          },
          {
            id: 'author',
            name: 'Author',
            description: 'Your name or organization',
            type: 'text',
            default: '',
          },
        ],
      },
      {
        id: 'frontend-options',
        name: 'Frontend Configuration',
        description: 'Configure frontend technologies',
        variables: [
          {
            id: 'uiLibrary',
            name: 'UI Component Library',
            description: 'Choose a UI component library',
            type: 'select',
            default: 'tailwind',
            options: [
              { value: 'tailwind', label: 'Tailwind CSS', description: 'Utility-first CSS framework' },
              { value: 'shadcn', label: 'shadcn/ui', description: 'Re-usable components built with Radix UI and Tailwind' },
              { value: 'mui', label: 'Material UI', description: 'React components following Material Design' },
              { value: 'chakra', label: 'Chakra UI', description: 'Simple, modular, accessible components' },
            ],
          },
          {
            id: 'stateManagement',
            name: 'State Management',
            description: 'Choose a state management solution',
            type: 'select',
            default: 'zustand',
            options: [
              { value: 'zustand', label: 'Zustand', description: 'Lightweight state management' },
              { value: 'redux', label: 'Redux Toolkit', description: 'Predictable state container' },
              { value: 'jotai', label: 'Jotai', description: 'Primitive and flexible state' },
              { value: 'context', label: 'React Context', description: 'Built-in React context API' },
            ],
          },
          {
            id: 'includeStorybook',
            name: 'Include Storybook',
            description: 'Add Storybook for component development',
            type: 'boolean',
            default: false,
          },
        ],
      },
      {
        id: 'backend-options',
        name: 'Backend Configuration',
        description: 'Configure backend technologies',
        variables: [
          {
            id: 'database',
            name: 'Database',
            description: 'Choose your database',
            type: 'select',
            default: 'postgresql',
            options: [
              { value: 'postgresql', label: 'PostgreSQL', description: 'Powerful open-source relational DB' },
              { value: 'mysql', label: 'MySQL', description: 'Popular open-source relational DB' },
              { value: 'mongodb', label: 'MongoDB', description: 'Document-oriented NoSQL database' },
              { value: 'sqlite', label: 'SQLite', description: 'Lightweight embedded database' },
            ],
          },
          {
            id: 'orm',
            name: 'ORM / Query Builder',
            description: 'Choose database access layer',
            type: 'select',
            default: 'prisma',
            options: [
              { value: 'prisma', label: 'Prisma', description: 'Next-generation ORM' },
              { value: 'drizzle', label: 'Drizzle', description: 'TypeScript ORM with SQL-like syntax' },
              { value: 'typeorm', label: 'TypeORM', description: 'ORM for TypeScript and JavaScript' },
              { value: 'knex', label: 'Knex.js', description: 'SQL query builder' },
            ],
          },
          {
            id: 'includeRedis',
            name: 'Include Redis',
            description: 'Add Redis for caching and sessions',
            type: 'boolean',
            default: true,
          },
        ],
      },
      {
        id: 'features',
        name: 'Features',
        description: 'Select features to include',
        variables: [
          {
            id: 'authProvider',
            name: 'Authentication',
            description: 'Choose authentication method',
            type: 'select',
            default: 'jwt',
            options: [
              { value: 'jwt', label: 'JWT Tokens', description: 'Stateless JWT authentication' },
              { value: 'session', label: 'Session-based', description: 'Traditional session authentication' },
              { value: 'oauth', label: 'OAuth 2.0', description: 'OAuth with social providers' },
              { value: 'none', label: 'None', description: 'No authentication (add later)' },
            ],
          },
          {
            id: 'includeDocker',
            name: 'Docker Support',
            description: 'Include Docker configuration',
            type: 'boolean',
            default: true,
          },
          {
            id: 'includeCICD',
            name: 'CI/CD Pipeline',
            description: 'Include GitHub Actions workflow',
            type: 'boolean',
            default: true,
          },
          {
            id: 'includeTests',
            name: 'Testing Setup',
            description: 'Include test configuration',
            type: 'boolean',
            default: true,
          },
        ],
      },
    ],
    quickCreate: {
      enabled: true,
      defaults: {
        projectName: 'my-fullstack-app',
        uiLibrary: 'tailwind',
        stateManagement: 'zustand',
        database: 'postgresql',
        orm: 'prisma',
        authProvider: 'jwt',
        includeDocker: true,
        includeCICD: true,
        includeTests: true,
        includeRedis: true,
        includeStorybook: false,
      },
    },
  },

  // ============================================================================
  // REST API SERVICE
  // ============================================================================
  {
    id: 'rest-api-service',
    name: 'REST API Service',
    description: 'Production-ready REST API with authentication, rate limiting, and documentation',
    longDescription: `A robust REST API template built with Node.js and Express, featuring JWT authentication, role-based access control, rate limiting, request validation, comprehensive error handling, and auto-generated OpenAPI documentation. Includes database integration, caching layer, and monitoring setup.`,
    icon: Rocket,
    color: 'from-purple-500 to-pink-500',
    category: 'api',
    tags: ['REST', 'Node.js', 'Express', 'JWT', 'OpenAPI', 'PostgreSQL'],
    difficulty: 'intermediate',
    estimatedSetupTime: '1-2 hours',
    techStack: [
      { name: 'Node.js', category: 'backend' },
      { name: 'Express', category: 'backend' },
      { name: 'TypeScript', category: 'backend' },
      { name: 'PostgreSQL', category: 'database' },
      { name: 'Prisma ORM', category: 'database' },
      { name: 'Redis', category: 'database' },
      { name: 'Swagger/OpenAPI', category: 'other' },
      { name: 'Jest', category: 'testing' },
      { name: 'Supertest', category: 'testing' },
    ],
    folderStructure: [
      {
        name: 'src',
        type: 'folder',
        children: [
          { name: 'controllers', type: 'folder', description: 'Request handlers' },
          { name: 'middleware', type: 'folder', description: 'Auth, validation, rate limiting' },
          { name: 'models', type: 'folder', description: 'Data models and DTOs' },
          { name: 'routes', type: 'folder', description: 'API route definitions' },
          { name: 'services', type: 'folder', description: 'Business logic layer' },
          { name: 'repositories', type: 'folder', description: 'Data access layer' },
          { name: 'utils', type: 'folder', description: 'Helpers and utilities' },
          { name: 'validators', type: 'folder', description: 'Request validation schemas' },
          { name: 'config', type: 'folder', description: 'Configuration management' },
          { name: 'types', type: 'folder', description: 'TypeScript definitions' },
          { name: 'app.ts', type: 'file' },
          { name: 'server.ts', type: 'file' },
        ],
      },
      { name: 'prisma', type: 'folder', children: [
        { name: 'schema.prisma', type: 'file' },
        { name: 'migrations', type: 'folder' },
        { name: 'seed.ts', type: 'file' },
      ]},
      { name: 'tests', type: 'folder', children: [
        { name: 'unit', type: 'folder' },
        { name: 'integration', type: 'folder' },
        { name: 'fixtures', type: 'folder' },
      ]},
      { name: 'docs', type: 'folder', children: [
        { name: 'openapi.yaml', type: 'file' },
      ]},
      { name: 'Dockerfile', type: 'file' },
      { name: 'docker-compose.yml', type: 'file' },
      { name: 'package.json', type: 'file' },
      { name: 'tsconfig.json', type: 'file' },
      { name: '.env.example', type: 'file' },
    ],
    setupTasks: [
      {
        id: 'design-api',
        title: 'Design API Architecture',
        description: 'Define resource endpoints, request/response schemas, authentication flow, and error handling strategy.',
        agentRole: 'architect',
        priority: 'high',
        estimatedTime: '25 min',
      },
      {
        id: 'setup-project',
        title: 'Initialize Project Structure',
        description: 'Create project with TypeScript, configure Express, set up environment variables and logging.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '15 min',
        dependencies: ['design-api'],
        commands: [
          'npm init -y',
          'npm install express cors helmet compression morgan dotenv',
          'npm install -D typescript @types/node @types/express ts-node-dev',
          'npx tsc --init',
        ],
      },
      {
        id: 'setup-database',
        title: 'Configure Database',
        description: 'Set up Prisma ORM, design schema, create migrations, implement repository pattern.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '20 min',
        dependencies: ['setup-project'],
      },
      {
        id: 'implement-auth',
        title: 'Build Authentication System',
        description: 'Implement JWT authentication, refresh tokens, password hashing, and role-based access control.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '35 min',
        dependencies: ['setup-database'],
      },
      {
        id: 'implement-middleware',
        title: 'Create Middleware Stack',
        description: 'Build validation middleware, rate limiter, error handler, request logger, and CORS configuration.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '25 min',
        dependencies: ['implement-auth'],
      },
      {
        id: 'create-endpoints',
        title: 'Implement API Endpoints',
        description: 'Build CRUD operations for all resources with proper validation, pagination, and filtering.',
        agentRole: 'implementer',
        priority: 'medium',
        estimatedTime: '40 min',
        dependencies: ['implement-middleware'],
      },
      {
        id: 'setup-caching',
        title: 'Implement Caching Layer',
        description: 'Set up Redis caching for frequently accessed data, implement cache invalidation strategies.',
        agentRole: 'implementer',
        priority: 'medium',
        estimatedTime: '20 min',
        dependencies: ['create-endpoints'],
      },
      {
        id: 'write-tests',
        title: 'Create Test Suite',
        description: 'Write unit tests for services, integration tests for endpoints, set up test database.',
        agentRole: 'tester',
        priority: 'medium',
        estimatedTime: '35 min',
        dependencies: ['create-endpoints'],
      },
      {
        id: 'security-audit',
        title: 'Security Review',
        description: 'Audit authentication, check for injection vulnerabilities, review rate limiting configuration.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '25 min',
        dependencies: ['implement-auth', 'create-endpoints'],
      },
      {
        id: 'generate-docs',
        title: 'Generate API Documentation',
        description: 'Create OpenAPI specification, set up Swagger UI, document all endpoints with examples.',
        agentRole: 'documenter',
        priority: 'medium',
        estimatedTime: '20 min',
        dependencies: ['create-endpoints'],
      },
    ],
    recommendedAgents: [
      {
        role: 'architect',
        name: 'API Architect',
        description: 'Designs API structure and data models',
        systemPrompt: `You are an expert API architect. Design RESTful APIs following best practices:
- Use proper HTTP methods and status codes
- Design consistent URL patterns
- Plan for versioning and backward compatibility
- Define clear request/response schemas
- Consider pagination, filtering, and sorting strategies`,
        priority: 1,
      },
      {
        role: 'implementer',
        name: 'Backend Developer',
        description: 'Implements API endpoints and business logic',
        systemPrompt: `You are an expert backend developer specializing in Node.js and Express. Focus on:
- Clean, maintainable code with proper error handling
- Input validation and sanitization
- Efficient database queries
- Proper use of async/await
- Following the repository pattern for data access`,
        priority: 2,
      },
      {
        role: 'tester',
        name: 'API Tester',
        description: 'Tests API endpoints and edge cases',
        systemPrompt: `You are an API testing expert. Your focus is:
- Testing all HTTP methods and status codes
- Validating request/response schemas
- Testing authentication and authorization
- Edge cases and error scenarios
- Performance and load testing considerations`,
        priority: 3,
      },
      {
        role: 'security',
        name: 'API Security Expert',
        description: 'Ensures API security best practices',
        systemPrompt: `You are an API security specialist. Review for:
- Authentication and authorization vulnerabilities
- Injection attacks (SQL, NoSQL, Command)
- Rate limiting and DDoS protection
- Data exposure and sensitive information
- CORS and CSRF protection`,
        priority: 4,
      },
    ],
    suggestedWorkflows: [
      {
        id: 'new-endpoint',
        name: 'Add New Endpoint',
        description: 'Workflow for adding a new API endpoint',
        steps: [
          'Architect defines endpoint specification',
          'Implementer creates database model',
          'Implementer builds controller and service',
          'Tester writes endpoint tests',
          'Documenter updates OpenAPI spec',
        ],
      },
    ],
    features: [
      'JWT authentication with refresh tokens',
      'Role-based access control (RBAC)',
      'Request validation with Zod',
      'Rate limiting per user/IP',
      'Redis caching layer',
      'OpenAPI documentation with Swagger UI',
      'Structured error responses',
      'Request logging and monitoring',
      'Database migrations',
      'Health check endpoint',
    ],
    prerequisites: [
      'Node.js 18+ installed',
      'PostgreSQL and Redis (or Docker)',
      'Understanding of REST principles',
      'Basic TypeScript knowledge',
    ],
    successCriteria: [
      'All endpoints return correct status codes',
      'Authentication works correctly',
      'Rate limiting prevents abuse',
      'API documentation is complete',
      '90%+ test coverage on services',
    ],
    optionGroups: [
      {
        id: 'api-config',
        name: 'API Configuration',
        description: 'Configure API settings',
        variables: [
          {
            id: 'apiVersion',
            name: 'API Version Prefix',
            description: 'Version prefix for API routes',
            type: 'select',
            default: 'v1',
            options: [
              { value: 'v1', label: '/api/v1', description: 'Versioned API path' },
              { value: 'none', label: '/api', description: 'No version prefix' },
            ],
          },
          {
            id: 'rateLimitRequests',
            name: 'Rate Limit (requests/min)',
            description: 'Maximum requests per minute per IP',
            type: 'number',
            default: 100,
            validation: { min: 10, max: 10000 },
          },
        ],
      },
    ],
    quickCreate: {
      enabled: true,
      defaults: {
        apiVersion: 'v1',
        rateLimitRequests: 100,
      },
    },
  },

  // ============================================================================
  // CLI APPLICATION
  // ============================================================================
  {
    id: 'cli-application',
    name: 'CLI Application',
    description: 'Professional command-line tool with subcommands, configuration, and beautiful output',
    longDescription: `A production-quality CLI application template featuring subcommands, interactive prompts, configuration file support, colorful output, progress indicators, and comprehensive help system. Built with best practices for distribution via npm or as standalone binaries.`,
    icon: Terminal,
    color: 'from-green-500 to-emerald-500',
    category: 'cli',
    tags: ['CLI', 'Node.js', 'TypeScript', 'Commander', 'Automation'],
    difficulty: 'beginner',
    estimatedSetupTime: '45 min - 1 hour',
    techStack: [
      { name: 'Node.js', category: 'backend' },
      { name: 'TypeScript', category: 'backend' },
      { name: 'Commander.js', category: 'other' },
      { name: 'Inquirer.js', category: 'other' },
      { name: 'Chalk', category: 'other' },
      { name: 'Ora', category: 'other' },
      { name: 'Jest', category: 'testing' },
    ],
    folderStructure: [
      {
        name: 'src',
        type: 'folder',
        children: [
          { name: 'commands', type: 'folder', description: 'CLI command implementations' },
          { name: 'lib', type: 'folder', description: 'Core library functions' },
          { name: 'utils', type: 'folder', description: 'Utility functions' },
          { name: 'config', type: 'folder', description: 'Configuration management' },
          { name: 'types', type: 'folder', description: 'TypeScript definitions' },
          { name: 'index.ts', type: 'file', description: 'CLI entry point' },
          { name: 'cli.ts', type: 'file', description: 'Command definitions' },
        ],
      },
      { name: 'tests', type: 'folder' },
      { name: 'bin', type: 'folder', children: [
        { name: 'cli.js', type: 'file', description: 'Executable entry point' },
      ]},
      { name: 'package.json', type: 'file' },
      { name: 'tsconfig.json', type: 'file' },
      { name: 'README.md', type: 'file' },
    ],
    setupTasks: [
      {
        id: 'design-cli',
        title: 'Design CLI Interface',
        description: 'Define commands, subcommands, options, and arguments. Plan user interaction flow.',
        agentRole: 'architect',
        priority: 'high',
        estimatedTime: '15 min',
      },
      {
        id: 'setup-project',
        title: 'Initialize CLI Project',
        description: 'Create project structure, configure TypeScript, set up build process for CLI.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '15 min',
        dependencies: ['design-cli'],
        commands: [
          'npm init -y',
          'npm install commander inquirer chalk ora conf',
          'npm install -D typescript @types/node @types/inquirer',
        ],
      },
      {
        id: 'implement-commands',
        title: 'Implement Commands',
        description: 'Build all CLI commands with proper option parsing, validation, and help text.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '30 min',
        dependencies: ['setup-project'],
      },
      {
        id: 'add-interactivity',
        title: 'Add Interactive Prompts',
        description: 'Implement interactive mode with prompts, confirmations, and selections.',
        agentRole: 'implementer',
        priority: 'medium',
        estimatedTime: '20 min',
        dependencies: ['implement-commands'],
      },
      {
        id: 'implement-config',
        title: 'Add Configuration Support',
        description: 'Implement config file loading, environment variables, and user preferences.',
        agentRole: 'implementer',
        priority: 'medium',
        estimatedTime: '15 min',
        dependencies: ['implement-commands'],
      },
      {
        id: 'add-output-formatting',
        title: 'Enhance Output Formatting',
        description: 'Add colors, tables, progress bars, and spinners for better UX.',
        agentRole: 'implementer',
        priority: 'medium',
        estimatedTime: '15 min',
        dependencies: ['implement-commands'],
      },
      {
        id: 'write-tests',
        title: 'Write CLI Tests',
        description: 'Test command parsing, option handling, and output formatting.',
        agentRole: 'tester',
        priority: 'medium',
        estimatedTime: '20 min',
        dependencies: ['implement-commands'],
      },
      {
        id: 'create-docs',
        title: 'Write Documentation',
        description: 'Create README with installation, usage examples, and configuration guide.',
        agentRole: 'documenter',
        priority: 'medium',
        estimatedTime: '15 min',
        dependencies: ['implement-commands'],
      },
    ],
    recommendedAgents: [
      {
        role: 'architect',
        name: 'CLI Designer',
        description: 'Designs CLI interface and user experience',
        systemPrompt: `You are a CLI UX expert. Design intuitive command-line interfaces:
- Clear command hierarchy and naming
- Consistent option patterns (--verbose, -v)
- Helpful error messages and suggestions
- Progressive disclosure of complexity
- Follow POSIX conventions where appropriate`,
        priority: 1,
      },
      {
        role: 'implementer',
        name: 'CLI Developer',
        description: 'Implements CLI commands and functionality',
        systemPrompt: `You are a CLI development expert. Build professional CLIs with:
- Robust argument parsing and validation
- Graceful error handling with helpful messages
- Support for both interactive and non-interactive modes
- Proper exit codes
- Cross-platform compatibility`,
        priority: 2,
      },
    ],
    suggestedWorkflows: [
      {
        id: 'add-command',
        name: 'Add New Command',
        description: 'Workflow for adding a new CLI command',
        steps: [
          'Architect designs command interface',
          'Implementer creates command handler',
          'Implementer adds help text and examples',
          'Tester writes command tests',
          'Documenter updates README',
        ],
      },
    ],
    features: [
      'Subcommand support',
      'Interactive prompts',
      'Configuration file support',
      'Colorful, formatted output',
      'Progress indicators and spinners',
      'Comprehensive help system',
      'Tab completion support',
      'Cross-platform compatibility',
    ],
    prerequisites: [
      'Node.js 18+ installed',
      'Basic command-line experience',
      'TypeScript knowledge helpful',
    ],
    successCriteria: [
      'All commands work as documented',
      'Help text is clear and complete',
      'Errors provide actionable guidance',
      'Works on Windows, macOS, and Linux',
    ],
  },

  // ============================================================================
  // SECURITY AUDIT
  // ============================================================================
  {
    id: 'security-audit',
    name: 'Security Audit Project',
    description: 'Comprehensive security assessment with vulnerability scanning and reporting',
    longDescription: `A structured security audit project template for assessing application security. Includes checklists for OWASP Top 10, automated scanning configurations, manual testing guides, vulnerability tracking, and professional report templates. Designed for thorough security assessments.`,
    icon: Shield,
    color: 'from-red-500 to-orange-500',
    category: 'security',
    tags: ['Security', 'Audit', 'OWASP', 'Penetration Testing', 'Vulnerability'],
    difficulty: 'advanced',
    estimatedSetupTime: '30 min setup, ongoing assessment',
    techStack: [
      { name: 'OWASP ZAP', category: 'testing' },
      { name: 'Burp Suite', category: 'testing', optional: true },
      { name: 'npm audit', category: 'testing' },
      { name: 'Snyk', category: 'testing', optional: true },
      { name: 'SQLMap', category: 'testing', optional: true },
    ],
    folderStructure: [
      {
        name: 'scope',
        type: 'folder',
        description: 'Audit scope and boundaries',
        children: [
          { name: 'scope-definition.md', type: 'file' },
          { name: 'assets-inventory.md', type: 'file' },
          { name: 'rules-of-engagement.md', type: 'file' },
        ],
      },
      {
        name: 'reconnaissance',
        type: 'folder',
        description: 'Information gathering',
        children: [
          { name: 'technology-stack.md', type: 'file' },
          { name: 'endpoints-map.md', type: 'file' },
          { name: 'authentication-flows.md', type: 'file' },
        ],
      },
      {
        name: 'checklists',
        type: 'folder',
        description: 'Security testing checklists',
        children: [
          { name: 'owasp-top-10.md', type: 'file' },
          { name: 'authentication.md', type: 'file' },
          { name: 'authorization.md', type: 'file' },
          { name: 'input-validation.md', type: 'file' },
          { name: 'data-protection.md', type: 'file' },
          { name: 'api-security.md', type: 'file' },
        ],
      },
      {
        name: 'findings',
        type: 'folder',
        description: 'Discovered vulnerabilities',
        children: [
          { name: 'critical', type: 'folder' },
          { name: 'high', type: 'folder' },
          { name: 'medium', type: 'folder' },
          { name: 'low', type: 'folder' },
          { name: 'informational', type: 'folder' },
        ],
      },
      {
        name: 'evidence',
        type: 'folder',
        description: 'Proof of vulnerabilities',
        children: [
          { name: 'screenshots', type: 'folder' },
          { name: 'requests', type: 'folder' },
          { name: 'scripts', type: 'folder' },
        ],
      },
      {
        name: 'reports',
        type: 'folder',
        description: 'Audit reports',
        children: [
          { name: 'executive-summary.md', type: 'file' },
          { name: 'technical-report.md', type: 'file' },
          { name: 'remediation-guide.md', type: 'file' },
        ],
      },
      { name: 'tools-config', type: 'folder', description: 'Scanner configurations' },
    ],
    setupTasks: [
      {
        id: 'define-scope',
        title: 'Define Audit Scope',
        description: 'Document target systems, boundaries, testing windows, and rules of engagement.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '20 min',
      },
      {
        id: 'reconnaissance',
        title: 'Conduct Reconnaissance',
        description: 'Map application architecture, identify technologies, discover endpoints and entry points.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '45 min',
        dependencies: ['define-scope'],
      },
      {
        id: 'automated-scanning',
        title: 'Run Automated Scans',
        description: 'Execute vulnerability scanners, dependency audits, and SAST tools.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '30 min',
        dependencies: ['reconnaissance'],
        commands: [
          'npm audit',
          'npx snyk test',
        ],
      },
      {
        id: 'auth-testing',
        title: 'Test Authentication',
        description: 'Assess login mechanisms, session management, password policies, and MFA.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '40 min',
        dependencies: ['reconnaissance'],
      },
      {
        id: 'authz-testing',
        title: 'Test Authorization',
        description: 'Check access controls, privilege escalation, IDOR vulnerabilities.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '40 min',
        dependencies: ['auth-testing'],
      },
      {
        id: 'injection-testing',
        title: 'Test for Injection Flaws',
        description: 'Check SQL injection, NoSQL injection, command injection, XSS.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '45 min',
        dependencies: ['reconnaissance'],
      },
      {
        id: 'data-exposure',
        title: 'Check Data Exposure',
        description: 'Review sensitive data handling, encryption, API responses for data leaks.',
        agentRole: 'security',
        priority: 'high',
        estimatedTime: '30 min',
        dependencies: ['reconnaissance'],
      },
      {
        id: 'document-findings',
        title: 'Document Findings',
        description: 'Create detailed write-ups for each vulnerability with evidence and reproduction steps.',
        agentRole: 'documenter',
        priority: 'medium',
        estimatedTime: '60 min',
        dependencies: ['auth-testing', 'authz-testing', 'injection-testing', 'data-exposure'],
      },
      {
        id: 'create-report',
        title: 'Generate Final Report',
        description: 'Compile executive summary, technical report, and remediation guide.',
        agentRole: 'documenter',
        priority: 'high',
        estimatedTime: '45 min',
        dependencies: ['document-findings'],
      },
    ],
    recommendedAgents: [
      {
        role: 'security',
        name: 'Security Auditor',
        description: 'Conducts comprehensive security assessments',
        systemPrompt: `You are an expert security auditor and penetration tester. Your expertise includes:
- OWASP Top 10 vulnerability assessment
- Authentication and authorization testing
- Injection vulnerability identification
- API security testing
- Secure code review
Provide detailed, reproducible findings with clear severity ratings and remediation guidance.`,
        priority: 1,
      },
      {
        role: 'documenter',
        name: 'Security Report Writer',
        description: 'Creates professional security reports',
        systemPrompt: `You are a security documentation specialist. Create clear, professional security reports:
- Executive summaries for non-technical stakeholders
- Detailed technical findings with evidence
- Risk ratings using CVSS or similar frameworks
- Actionable remediation recommendations
- Compliance mapping (OWASP, CWE, etc.)`,
        priority: 2,
      },
    ],
    suggestedWorkflows: [
      {
        id: 'full-audit',
        name: 'Complete Security Audit',
        description: 'End-to-end security assessment workflow',
        steps: [
          'Define scope and rules of engagement',
          'Conduct reconnaissance and mapping',
          'Run automated vulnerability scans',
          'Perform manual testing for auth/authz',
          'Test for injection vulnerabilities',
          'Review data handling and encryption',
          'Document all findings with evidence',
          'Generate executive and technical reports',
          'Present findings and remediation plan',
        ],
      },
    ],
    features: [
      'OWASP Top 10 checklist coverage',
      'Automated scanning integration',
      'Structured finding documentation',
      'Evidence collection and management',
      'Risk-rated vulnerability tracking',
      'Executive and technical report templates',
      'Remediation guidance',
      'Compliance mapping',
    ],
    prerequisites: [
      'Authorization to test target systems',
      'Understanding of web application security',
      'Familiarity with security testing tools',
      'Knowledge of common vulnerabilities',
    ],
    successCriteria: [
      'All OWASP Top 10 categories assessed',
      'All critical/high findings documented',
      'Evidence collected for each finding',
      'Remediation steps provided',
      'Reports reviewed and delivered',
    ],
  },

  // ============================================================================
  // NPM PACKAGE / LIBRARY
  // ============================================================================
  {
    id: 'npm-package',
    name: 'NPM Package / Library',
    description: 'Publishable npm package with TypeScript, testing, and documentation',
    longDescription: `A professional npm package template with TypeScript support, comprehensive testing setup, automated publishing workflow, semantic versioning, and beautiful documentation. Includes ESM and CommonJS builds, tree-shaking support, and playground examples.`,
    icon: Package,
    color: 'from-yellow-500 to-amber-500',
    category: 'library',
    tags: ['npm', 'Package', 'Library', 'TypeScript', 'Open Source'],
    difficulty: 'intermediate',
    estimatedSetupTime: '1-2 hours',
    techStack: [
      { name: 'TypeScript', category: 'backend' },
      { name: 'tsup', category: 'other' },
      { name: 'Vitest', category: 'testing' },
      { name: 'TypeDoc', category: 'other' },
      { name: 'Changesets', category: 'devops' },
      { name: 'GitHub Actions', category: 'devops' },
    ],
    folderStructure: [
      {
        name: 'src',
        type: 'folder',
        children: [
          { name: 'index.ts', type: 'file', description: 'Main entry point' },
          { name: 'core', type: 'folder', description: 'Core functionality' },
          { name: 'utils', type: 'folder', description: 'Utility functions' },
          { name: 'types', type: 'folder', description: 'Type definitions' },
        ],
      },
      { name: 'tests', type: 'folder' },
      { name: 'examples', type: 'folder', description: 'Usage examples' },
      { name: 'docs', type: 'folder', description: 'Documentation' },
      { name: '.changeset', type: 'folder', description: 'Version management' },
      { name: '.github', type: 'folder', children: [
        { name: 'workflows', type: 'folder', children: [
          { name: 'ci.yml', type: 'file' },
          { name: 'release.yml', type: 'file' },
        ]},
      ]},
      { name: 'package.json', type: 'file' },
      { name: 'tsconfig.json', type: 'file' },
      { name: 'tsup.config.ts', type: 'file' },
      { name: 'README.md', type: 'file' },
      { name: 'LICENSE', type: 'file' },
      { name: 'CONTRIBUTING.md', type: 'file' },
    ],
    setupTasks: [
      {
        id: 'design-api',
        title: 'Design Package API',
        description: 'Define public API surface, function signatures, and type definitions.',
        agentRole: 'architect',
        priority: 'high',
        estimatedTime: '25 min',
      },
      {
        id: 'setup-project',
        title: 'Initialize Package',
        description: 'Create package.json with proper configuration, set up TypeScript and build tools.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '20 min',
        dependencies: ['design-api'],
      },
      {
        id: 'implement-core',
        title: 'Implement Core Functionality',
        description: 'Build the main package functionality with proper TypeScript types.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '45 min',
        dependencies: ['setup-project'],
      },
      {
        id: 'write-tests',
        title: 'Write Comprehensive Tests',
        description: 'Create unit tests with high coverage, edge case testing.',
        agentRole: 'tester',
        priority: 'high',
        estimatedTime: '30 min',
        dependencies: ['implement-core'],
      },
      {
        id: 'setup-build',
        title: 'Configure Build Pipeline',
        description: 'Set up tsup for ESM/CJS builds, configure exports in package.json.',
        agentRole: 'devops',
        priority: 'medium',
        estimatedTime: '20 min',
        dependencies: ['implement-core'],
      },
      {
        id: 'setup-ci',
        title: 'Configure CI/CD',
        description: 'Set up GitHub Actions for testing, building, and publishing.',
        agentRole: 'devops',
        priority: 'medium',
        estimatedTime: '20 min',
        dependencies: ['write-tests', 'setup-build'],
      },
      {
        id: 'create-docs',
        title: 'Generate Documentation',
        description: 'Write README, API documentation, and usage examples.',
        agentRole: 'documenter',
        priority: 'medium',
        estimatedTime: '30 min',
        dependencies: ['implement-core'],
      },
      {
        id: 'create-examples',
        title: 'Create Examples',
        description: 'Build example projects showing package usage.',
        agentRole: 'implementer',
        priority: 'low',
        estimatedTime: '20 min',
        dependencies: ['implement-core'],
      },
    ],
    recommendedAgents: [
      {
        role: 'architect',
        name: 'API Designer',
        description: 'Designs clean, intuitive package APIs',
        systemPrompt: `You are an expert in API design for JavaScript/TypeScript libraries. Focus on:
- Intuitive, consistent naming conventions
- Proper TypeScript type definitions
- Minimal public API surface
- Backward compatibility considerations
- Tree-shaking friendly exports`,
        priority: 1,
      },
      {
        role: 'implementer',
        name: 'Library Developer',
        description: 'Implements package functionality',
        systemPrompt: `You are an expert library developer. Build packages with:
- Clean, well-documented code
- Proper error handling and validation
- Performance optimization
- Zero runtime dependencies when possible
- Support for both ESM and CommonJS`,
        priority: 2,
      },
    ],
    suggestedWorkflows: [
      {
        id: 'release',
        name: 'Release New Version',
        description: 'Workflow for releasing a new package version',
        steps: [
          'Create changeset for version bump',
          'Run full test suite',
          'Build package',
          'Generate updated docs',
          'Publish to npm',
          'Create GitHub release',
        ],
      },
    ],
    features: [
      'TypeScript with full type definitions',
      'ESM and CommonJS dual builds',
      'Tree-shaking support',
      'Semantic versioning with Changesets',
      'Automated npm publishing',
      'Generated API documentation',
      'Comprehensive test coverage',
      'Usage examples',
    ],
    prerequisites: [
      'npm account for publishing',
      'GitHub repository',
      'Understanding of module systems',
      'TypeScript knowledge',
    ],
    successCriteria: [
      'Package installs without errors',
      'Types work correctly in consuming projects',
      'All tests pass',
      '95%+ code coverage',
      'Documentation is complete',
      'Successfully published to npm',
    ],
  },

  // ============================================================================
  // DOCUMENTATION PROJECT
  // ============================================================================
  {
    id: 'documentation-project',
    name: 'Technical Documentation',
    description: 'Professional documentation site with guides, API reference, and search',
    longDescription: `A comprehensive documentation project template using modern documentation tools. Includes structured guides, auto-generated API reference, search functionality, versioning support, and beautiful themes. Perfect for open source projects or internal documentation.`,
    icon: BookOpen,
    color: 'from-indigo-500 to-blue-500',
    category: 'documentation',
    tags: ['Documentation', 'Guides', 'API Reference', 'MDX', 'Search'],
    difficulty: 'beginner',
    estimatedSetupTime: '30-45 min',
    techStack: [
      { name: 'Docusaurus', category: 'frontend' },
      { name: 'MDX', category: 'frontend' },
      { name: 'Algolia', category: 'other', optional: true },
      { name: 'TypeDoc', category: 'other', optional: true },
    ],
    folderStructure: [
      {
        name: 'docs',
        type: 'folder',
        children: [
          { name: 'getting-started', type: 'folder', children: [
            { name: 'introduction.md', type: 'file' },
            { name: 'installation.md', type: 'file' },
            { name: 'quick-start.md', type: 'file' },
          ]},
          { name: 'guides', type: 'folder', children: [
            { name: 'basic-usage.md', type: 'file' },
            { name: 'advanced-features.md', type: 'file' },
            { name: 'best-practices.md', type: 'file' },
          ]},
          { name: 'api-reference', type: 'folder' },
          { name: 'tutorials', type: 'folder' },
          { name: 'faq.md', type: 'file' },
        ],
      },
      { name: 'blog', type: 'folder', description: 'Release notes and articles' },
      { name: 'src', type: 'folder', children: [
        { name: 'components', type: 'folder' },
        { name: 'css', type: 'folder' },
        { name: 'pages', type: 'folder' },
      ]},
      { name: 'static', type: 'folder', description: 'Images and assets' },
      { name: 'docusaurus.config.js', type: 'file' },
      { name: 'sidebars.js', type: 'file' },
    ],
    setupTasks: [
      {
        id: 'plan-structure',
        title: 'Plan Documentation Structure',
        description: 'Define documentation hierarchy, categories, and navigation flow.',
        agentRole: 'architect',
        priority: 'high',
        estimatedTime: '15 min',
      },
      {
        id: 'setup-docusaurus',
        title: 'Initialize Documentation Site',
        description: 'Set up Docusaurus with configuration, theme, and plugins.',
        agentRole: 'implementer',
        priority: 'high',
        estimatedTime: '15 min',
        dependencies: ['plan-structure'],
        commands: [
          'npx create-docusaurus@latest docs classic',
        ],
      },
      {
        id: 'write-getting-started',
        title: 'Write Getting Started Guides',
        description: 'Create introduction, installation, and quick start guides.',
        agentRole: 'documenter',
        priority: 'high',
        estimatedTime: '30 min',
        dependencies: ['setup-docusaurus'],
      },
      {
        id: 'write-guides',
        title: 'Write Usage Guides',
        description: 'Create comprehensive guides for features and use cases.',
        agentRole: 'documenter',
        priority: 'medium',
        estimatedTime: '45 min',
        dependencies: ['write-getting-started'],
      },
      {
        id: 'generate-api-docs',
        title: 'Generate API Reference',
        description: 'Auto-generate API documentation from source code.',
        agentRole: 'documenter',
        priority: 'medium',
        estimatedTime: '20 min',
        dependencies: ['setup-docusaurus'],
      },
      {
        id: 'create-tutorials',
        title: 'Create Tutorials',
        description: 'Build step-by-step tutorials for common tasks.',
        agentRole: 'documenter',
        priority: 'medium',
        estimatedTime: '40 min',
        dependencies: ['write-guides'],
      },
      {
        id: 'setup-search',
        title: 'Configure Search',
        description: 'Set up search functionality with Algolia or local search.',
        agentRole: 'implementer',
        priority: 'low',
        estimatedTime: '15 min',
        dependencies: ['setup-docusaurus'],
      },
      {
        id: 'deploy',
        title: 'Deploy Documentation',
        description: 'Set up deployment to GitHub Pages or Vercel.',
        agentRole: 'devops',
        priority: 'medium',
        estimatedTime: '15 min',
        dependencies: ['write-getting-started'],
      },
    ],
    recommendedAgents: [
      {
        role: 'documenter',
        name: 'Technical Writer',
        description: 'Creates clear, comprehensive documentation',
        systemPrompt: `You are an expert technical writer. Create documentation that is:
- Clear and concise for the target audience
- Well-organized with logical flow
- Rich with examples and code snippets
- Accessible to beginners while useful for experts
- Consistent in terminology and style`,
        priority: 1,
      },
      {
        role: 'architect',
        name: 'Documentation Architect',
        description: 'Plans documentation structure and information architecture',
        systemPrompt: `You are a documentation architecture expert. Design docs that:
- Have intuitive navigation and hierarchy
- Group related content logically
- Provide multiple entry points for different user types
- Include comprehensive cross-referencing
- Support versioning and localization`,
        priority: 2,
      },
    ],
    suggestedWorkflows: [
      {
        id: 'doc-update',
        name: 'Documentation Update',
        description: 'Workflow for updating documentation',
        steps: [
          'Identify documentation gaps',
          'Plan content structure',
          'Write or update content',
          'Add code examples',
          'Review for accuracy',
          'Deploy updated docs',
        ],
      },
    ],
    features: [
      'MDX support for interactive docs',
      'Auto-generated sidebar navigation',
      'Full-text search',
      'Version support',
      'Dark/light theme',
      'API reference generation',
      'Blog/changelog support',
      'Mobile-responsive design',
    ],
    prerequisites: [
      'Node.js 18+ installed',
      'Basic Markdown knowledge',
      'Content to document',
    ],
    successCriteria: [
      'Getting started guide is complete',
      'All major features are documented',
      'API reference is generated',
      'Search works correctly',
      'Site deploys successfully',
    ],
  },

  // ============================================================================
  // MOBILE APP (React Native)
  // ============================================================================
  {
    id: 'mobile-app',
    name: 'Mobile App (React Native)',
    description: 'Cross-platform mobile app with Expo and TypeScript',
    longDescription: `A production-ready React Native mobile application using Expo for rapid development. Includes navigation, state management, native modules, push notifications setup, and app store deployment guides.`,
    icon: Smartphone,
    color: 'from-pink-500 to-rose-500',
    category: 'mobile',
    tags: ['React Native', 'Expo', 'iOS', 'Android', 'Mobile', 'TypeScript'],
    difficulty: 'intermediate',
    estimatedSetupTime: '1-2 hours',
    techStack: [
      { name: 'React Native', category: 'frontend' },
      { name: 'Expo', category: 'frontend' },
      { name: 'TypeScript', category: 'frontend' },
      { name: 'React Navigation', category: 'frontend' },
      { name: 'Zustand', category: 'frontend' },
      { name: 'Expo Router', category: 'frontend' },
    ],
    folderStructure: [
      {
        name: 'app',
        type: 'folder',
        description: 'Expo Router screens',
        children: [
          { name: '(tabs)', type: 'folder', description: 'Tab navigation screens' },
          { name: '(auth)', type: 'folder', description: 'Authentication screens' },
          { name: '_layout.tsx', type: 'file' },
          { name: 'index.tsx', type: 'file' },
        ],
      },
      { name: 'components', type: 'folder', description: 'Reusable components' },
      { name: 'hooks', type: 'folder', description: 'Custom hooks' },
      { name: 'services', type: 'folder', description: 'API services' },
      { name: 'stores', type: 'folder', description: 'State management' },
      { name: 'assets', type: 'folder', description: 'Images and fonts' },
      { name: 'app.json', type: 'file' },
      { name: 'package.json', type: 'file' },
    ],
    setupTasks: [
      { id: 'design-ui', title: 'Design Mobile UI/UX', description: 'Create mobile-first UI designs and navigation flow.', agentRole: 'architect', priority: 'high', estimatedTime: '30 min' },
      { id: 'setup-expo', title: 'Initialize Expo Project', description: 'Create Expo app with TypeScript template.', agentRole: 'implementer', priority: 'high', estimatedTime: '15 min', commands: ['npx create-expo-app@latest -t expo-template-blank-typescript'] },
      { id: 'setup-navigation', title: 'Configure Navigation', description: 'Set up Expo Router with tab and stack navigation.', agentRole: 'implementer', priority: 'high', estimatedTime: '25 min', dependencies: ['setup-expo'] },
      { id: 'build-components', title: 'Build UI Components', description: 'Create reusable mobile components.', agentRole: 'implementer', priority: 'medium', estimatedTime: '40 min', dependencies: ['setup-navigation'] },
      { id: 'implement-auth', title: 'Implement Authentication', description: 'Add secure login and token storage.', agentRole: 'implementer', priority: 'high', estimatedTime: '35 min', dependencies: ['setup-navigation'] },
    ],
    recommendedAgents: [
      { role: 'architect', name: 'Mobile UX Designer', description: 'Designs mobile-first interfaces', systemPrompt: 'You are an expert mobile UX designer. Focus on touch-friendly interfaces, gesture navigation, and platform-specific patterns.', priority: 1 },
      { role: 'implementer', name: 'React Native Developer', description: 'Implements mobile features', systemPrompt: 'You are an expert React Native developer. Focus on performance, native feel, and cross-platform compatibility.', priority: 2 },
    ],
    suggestedWorkflows: [],
    features: ['Cross-platform (iOS & Android)', 'Expo managed workflow', 'File-based routing', 'Push notifications', 'Secure token storage', 'Dark mode support'],
    prerequisites: ['Node.js 18+', 'Expo CLI', 'iOS Simulator or Android Emulator'],
    successCriteria: ['Runs on iOS and Android', 'Navigation works smoothly', 'Authentication is secure'],
    optionGroups: [
      {
        id: 'platform',
        name: 'Platform & Navigation',
        description: 'Configure platform settings',
        variables: [
          { id: 'navigationType', name: 'Navigation Style', description: 'Choose navigation pattern', type: 'select', default: 'tabs', options: [{ value: 'tabs', label: 'Tab Navigation' }, { value: 'drawer', label: 'Drawer Navigation' }, { value: 'stack', label: 'Stack Only' }] },
          { id: 'includeAuth', name: 'Authentication Screens', description: 'Include login/signup screens', type: 'boolean', default: true },
        ],
      },
    ],
    quickCreate: { enabled: true, defaults: { navigationType: 'tabs', includeAuth: true } },
  },

  // ============================================================================
  // DATA PIPELINE (Python)
  // ============================================================================
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    description: 'Python data processing pipeline with ETL and analytics',
    longDescription: `A robust data pipeline template for ETL operations, data transformation, and analytics. Includes data validation, scheduling, monitoring, and integration with popular data stores.`,
    icon: Database,
    color: 'from-emerald-500 to-teal-500',
    category: 'data',
    tags: ['Python', 'ETL', 'Data', 'Analytics', 'Pandas', 'Pipeline'],
    difficulty: 'intermediate',
    estimatedSetupTime: '1-2 hours',
    techStack: [
      { name: 'Python 3.11+', category: 'backend' },
      { name: 'Pandas', category: 'other' },
      { name: 'SQLAlchemy', category: 'database' },
      { name: 'Pydantic', category: 'other' },
      { name: 'Prefect/Airflow', category: 'devops', optional: true },
    ],
    folderStructure: [
      { name: 'src', type: 'folder', children: [
        { name: 'extractors', type: 'folder', description: 'Data extraction modules' },
        { name: 'transformers', type: 'folder', description: 'Data transformation logic' },
        { name: 'loaders', type: 'folder', description: 'Data loading destinations' },
        { name: 'validators', type: 'folder', description: 'Data validation schemas' },
        { name: 'utils', type: 'folder' },
      ]},
      { name: 'tests', type: 'folder' },
      { name: 'configs', type: 'folder' },
      { name: 'pyproject.toml', type: 'file' },
    ],
    setupTasks: [
      { id: 'design-pipeline', title: 'Design Pipeline Architecture', description: 'Map data sources, transformations, and destinations.', agentRole: 'architect', priority: 'high', estimatedTime: '25 min' },
      { id: 'setup-project', title: 'Initialize Python Project', description: 'Set up Python project with dependencies.', agentRole: 'implementer', priority: 'high', estimatedTime: '15 min', commands: ['python -m venv venv', 'pip install pandas sqlalchemy pydantic'] },
      { id: 'build-extractors', title: 'Build Data Extractors', description: 'Create modules to extract data from sources.', agentRole: 'implementer', priority: 'high', estimatedTime: '30 min', dependencies: ['setup-project'] },
      { id: 'build-transformers', title: 'Build Transformers', description: 'Implement data transformation logic.', agentRole: 'implementer', priority: 'high', estimatedTime: '35 min', dependencies: ['build-extractors'] },
      { id: 'build-loaders', title: 'Build Data Loaders', description: 'Create modules to load data to destinations.', agentRole: 'implementer', priority: 'high', estimatedTime: '25 min', dependencies: ['build-transformers'] },
    ],
    recommendedAgents: [
      { role: 'architect', name: 'Data Architect', description: 'Designs data pipeline architecture', systemPrompt: 'You are a data architecture expert. Design efficient, scalable data pipelines with proper error handling and monitoring.', priority: 1 },
      { role: 'implementer', name: 'Data Engineer', description: 'Implements ETL processes', systemPrompt: 'You are an expert data engineer. Write efficient, maintainable Python code for data processing with proper validation.', priority: 2 },
    ],
    suggestedWorkflows: [],
    features: ['Modular ETL architecture', 'Data validation with Pydantic', 'Error handling & retries', 'Logging & monitoring', 'Configurable pipelines'],
    prerequisites: ['Python 3.11+', 'Understanding of data processing', 'Database access'],
    successCriteria: ['Pipeline runs end-to-end', 'Data validation works', 'Errors are handled gracefully'],
    quickCreate: { enabled: true, defaults: {} },
  },

  // ============================================================================
  // MICROSERVICES
  // ============================================================================
  {
    id: 'microservices',
    name: 'Microservices Architecture',
    description: 'Distributed microservices with Docker, API Gateway, and messaging',
    longDescription: `A microservices architecture template with multiple services, API gateway, message queue, service discovery, and container orchestration. Designed for scalable, distributed systems.`,
    icon: Boxes,
    color: 'from-violet-500 to-purple-500',
    category: 'api',
    tags: ['Microservices', 'Docker', 'Kubernetes', 'RabbitMQ', 'API Gateway', 'Distributed'],
    difficulty: 'advanced',
    estimatedSetupTime: '3-4 hours',
    techStack: [
      { name: 'Node.js/Go/Rust', category: 'backend' },
      { name: 'Docker', category: 'devops' },
      { name: 'Kubernetes', category: 'devops', optional: true },
      { name: 'RabbitMQ/Kafka', category: 'other' },
      { name: 'Redis', category: 'database' },
      { name: 'PostgreSQL', category: 'database' },
    ],
    folderStructure: [
      { name: 'services', type: 'folder', children: [
        { name: 'api-gateway', type: 'folder', description: 'API Gateway service' },
        { name: 'auth-service', type: 'folder', description: 'Authentication service' },
        { name: 'user-service', type: 'folder', description: 'User management service' },
        { name: 'notification-service', type: 'folder', description: 'Notification handling' },
      ]},
      { name: 'shared', type: 'folder', description: 'Shared libraries and types' },
      { name: 'infrastructure', type: 'folder', children: [
        { name: 'docker', type: 'folder' },
        { name: 'k8s', type: 'folder' },
      ]},
      { name: 'docker-compose.yml', type: 'file' },
    ],
    setupTasks: [
      { id: 'design-services', title: 'Design Service Architecture', description: 'Define service boundaries, APIs, and communication patterns.', agentRole: 'architect', priority: 'high', estimatedTime: '45 min' },
      { id: 'setup-infra', title: 'Set Up Infrastructure', description: 'Configure Docker, message queues, and databases.', agentRole: 'devops', priority: 'high', estimatedTime: '30 min' },
      { id: 'build-gateway', title: 'Build API Gateway', description: 'Implement API gateway with routing and auth.', agentRole: 'implementer', priority: 'high', estimatedTime: '40 min', dependencies: ['setup-infra'] },
      { id: 'build-services', title: 'Build Core Services', description: 'Implement individual microservices.', agentRole: 'implementer', priority: 'high', estimatedTime: '90 min', dependencies: ['build-gateway'] },
    ],
    recommendedAgents: [
      { role: 'architect', name: 'Distributed Systems Architect', description: 'Designs microservice architecture', systemPrompt: 'You are an expert in distributed systems. Design loosely coupled, resilient microservices with proper service boundaries.', priority: 1 },
      { role: 'devops', name: 'Platform Engineer', description: 'Sets up infrastructure', systemPrompt: 'You are a platform engineering expert. Configure container orchestration, service mesh, and observability.', priority: 2 },
    ],
    suggestedWorkflows: [],
    features: ['Service isolation', 'API Gateway routing', 'Message queue integration', 'Service discovery', 'Distributed tracing', 'Container orchestration'],
    prerequisites: ['Docker & Docker Compose', 'Understanding of distributed systems', 'Kubernetes basics (optional)'],
    successCriteria: ['All services communicate correctly', 'Gateway routes properly', 'Message queue works'],
    quickCreate: { enabled: true, defaults: {} },
  },

  // ============================================================================
  // CLOUD INFRASTRUCTURE (Terraform)
  // ============================================================================
  {
    id: 'cloud-infrastructure',
    name: 'Cloud Infrastructure (IaC)',
    description: 'Infrastructure as Code with Terraform for AWS/GCP/Azure',
    longDescription: `A Terraform-based infrastructure template for provisioning cloud resources. Includes modules for common patterns, environment management, state management, and CI/CD integration.`,
    icon: Cloud,
    color: 'from-sky-500 to-blue-500',
    category: 'devops',
    tags: ['Terraform', 'AWS', 'GCP', 'Azure', 'IaC', 'DevOps', 'Cloud'],
    difficulty: 'advanced',
    estimatedSetupTime: '2-3 hours',
    techStack: [
      { name: 'Terraform', category: 'devops' },
      { name: 'AWS/GCP/Azure', category: 'devops' },
      { name: 'GitHub Actions', category: 'devops' },
    ],
    folderStructure: [
      { name: 'modules', type: 'folder', children: [
        { name: 'networking', type: 'folder' },
        { name: 'compute', type: 'folder' },
        { name: 'database', type: 'folder' },
        { name: 'storage', type: 'folder' },
      ]},
      { name: 'environments', type: 'folder', children: [
        { name: 'dev', type: 'folder' },
        { name: 'staging', type: 'folder' },
        { name: 'prod', type: 'folder' },
      ]},
      { name: 'main.tf', type: 'file' },
      { name: 'variables.tf', type: 'file' },
      { name: 'outputs.tf', type: 'file' },
    ],
    setupTasks: [
      { id: 'design-infra', title: 'Design Infrastructure', description: 'Plan cloud architecture and resource requirements.', agentRole: 'architect', priority: 'high', estimatedTime: '30 min' },
      { id: 'setup-state', title: 'Configure State Backend', description: 'Set up remote state storage and locking.', agentRole: 'devops', priority: 'high', estimatedTime: '20 min' },
      { id: 'build-modules', title: 'Build Terraform Modules', description: 'Create reusable infrastructure modules.', agentRole: 'devops', priority: 'high', estimatedTime: '45 min', dependencies: ['setup-state'] },
      { id: 'setup-environments', title: 'Configure Environments', description: 'Set up dev, staging, and prod environments.', agentRole: 'devops', priority: 'medium', estimatedTime: '30 min', dependencies: ['build-modules'] },
    ],
    recommendedAgents: [
      { role: 'architect', name: 'Cloud Architect', description: 'Designs cloud infrastructure', systemPrompt: 'You are a cloud architecture expert. Design scalable, secure, cost-effective infrastructure.', priority: 1 },
      { role: 'devops', name: 'Infrastructure Engineer', description: 'Implements IaC', systemPrompt: 'You are a Terraform expert. Write clean, modular, reusable infrastructure code.', priority: 2 },
    ],
    suggestedWorkflows: [],
    features: ['Modular infrastructure', 'Multi-environment support', 'Remote state management', 'CI/CD integration', 'Cost estimation'],
    prerequisites: ['Terraform installed', 'Cloud provider account', 'Understanding of cloud services'],
    successCriteria: ['Infrastructure provisions successfully', 'State is properly managed', 'Environments are isolated'],
    optionGroups: [
      {
        id: 'cloud-provider',
        name: 'Cloud Provider',
        description: 'Select your cloud provider',
        variables: [
          { id: 'provider', name: 'Cloud Provider', description: 'Choose cloud provider', type: 'select', default: 'aws', options: [{ value: 'aws', label: 'AWS' }, { value: 'gcp', label: 'Google Cloud' }, { value: 'azure', label: 'Azure' }] },
        ],
      },
    ],
    quickCreate: { enabled: true, defaults: { provider: 'aws' } },
  },
];

// Helper function to get template by ID
export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

// Helper function to get templates by category
export function getTemplatesByCategory(category: TemplateCategory): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter((t) => t.category === category);
}

// Helper function to search templates
export function searchTemplates(query: string): ProjectTemplate[] {
  const lowerQuery = query.toLowerCase();
  return PROJECT_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

// Template usage tracking (localStorage-based)
const FAVORITES_KEY = 'nexus-template-favorites';
const RECENTS_KEY = 'nexus-template-recents';
const MAX_RECENTS = 5;

export function getFavoriteTemplates(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(FAVORITES_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function toggleFavorite(templateId: string): boolean {
  const favorites = getFavoriteTemplates();
  const index = favorites.indexOf(templateId);
  if (index === -1) {
    favorites.push(templateId);
  } else {
    favorites.splice(index, 1);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  return index === -1; // returns true if added, false if removed
}

export function isFavorite(templateId: string): boolean {
  return getFavoriteTemplates().includes(templateId);
}

export function getRecentTemplates(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(RECENTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addRecentTemplate(templateId: string): void {
  const recents = getRecentTemplates();
  const filtered = recents.filter((id) => id !== templateId);
  filtered.unshift(templateId);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(filtered.slice(0, MAX_RECENTS)));
}

// Get all unique tags from templates
export function getAllTags(): string[] {
  const tags = new Set<string>();
  PROJECT_TEMPLATES.forEach((t) => t.tags.forEach((tag) => tags.add(tag)));
  return Array.from(tags).sort();
}

// Get templates by difficulty
export function getTemplatesByDifficulty(difficulty: ProjectTemplate['difficulty']): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter((t) => t.difficulty === difficulty);
}

// Get templates with quick create enabled
export function getQuickCreateTemplates(): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter((t) => t.quickCreate?.enabled);
}
