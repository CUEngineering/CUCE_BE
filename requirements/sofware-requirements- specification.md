# Software Requirements Specification (SRS)

This document defines the software requirements for the **CU Course Enrollment Platform**. The platform is designed to streamline the university’s course enrollment process and is divided into two repositories: one for the backend and one for the frontend.

---

## 1. System Design

For the given complexity, a **modular monolithic application** is recommended. This design simplifies development, testing, deployment, and maintenance while supporting future growth.

---

## 2. Architecture Pattern

- **Backend**:  
  A **modular monolithic architecture** using the MVC (Model-View-Controller) pattern is recommended.

- **Frontend**:  
  Utilize Nuxt’s file-based routing and component-based design to organize the UI, manage state, and handle API interactions efficiently.

---

## 3. State Management

- **Frontend**:

  - Use **Pinia** as the state management solution in the Vue/Nuxt application.

- **Backend**:
  - Maintain stateless RESTful endpoints with a clear separation of concerns across controllers, services, and data access layers.

---

## 4. Data Flow

- **Frontend Data Flow**:

  - **Unidirectional Flow**:  
    Components dispatch actions to update the Pinia store, and UI components subscribe to store changes for rendering.
  - **API Interaction**:  
    Data is fetched and updated via RESTful endpoints using standard HTTP methods (GET, POST, PUT, DELETE).

- **Backend Data Flow**:
  - **Request Processing**:  
    HTTP requests are received by controllers, which invoke service layers to apply business logic and interact with the Supabase database.
  - **Response Handling**:  
    The backend sends JSON responses containing processed data back to the frontend.

---

## 5. Technical Stack

- **Backend**:

  - **Language/Runtime**: Node.js with **TypeScript**
  - **Framework**: **NestJS**
  - **Database**: Supabase (PostgreSQL)
  - **Authentication**: Supabase Auth
  - **ORM**: **Prisma**

- **Frontend**:

  - **Framework**: Vue with Nuxt
  - **Styling**: Tailwind CSS with Shadcn UI components (or SCSS as an alternative)
  - **State Management**: Pinia

- **Additional Tools**:
  - Email notification service: Resend
  - API testing and documentation tools: Postman

---

## 6. Authentication Process

- **Mechanism**:  
  Leverage **Supabase Auth** for user authentication and management.

  - **Session Management**:  
    Supabase handles token-based authentication and role-based access control, ensuring secure session management.

---

## 7. Route Design

- **Backend Routes (RESTful)**:  
  Design endpoints according to RESTful principles. Examples are:

  - **Programs**:
    - `GET /api/programs` – List all programs.
    - `POST /api/programs` – Create a new program.
    - `PUT /api/programs/:id` – Update a program.
    - `DELETE /api/programs/:id` – Delete a program.
  - **Courses**:
    - `GET /api/courses`
    - `POST /api/courses`
    - `PUT /api/courses/:id`
    - `DELETE /api/courses/:id`
  - **Sessions**:
    - `GET /api/sessions`
    - `POST /api/sessions`
    - `PUT /api/sessions/:id`
    - `DELETE /api/sessions/:id`
  - **Enrollments**:
    - `GET /api/enrollments`
    - `POST /api/enrollments`
    - `PUT /api/enrollments/:id` (for approval/rejection actions)
  - **Invitations**:
    - `POST /api/invitations` – Create an invitation.
    - `GET /api/invitations/:token` – Validate an invitation.

- **Frontend Routes (Nuxt Pages)**:
  - Use Nuxt’s file-based routing where each file corresponds to a specific page (e.g., dashboard, enrollment list, course details), simplifying navigation and route management.

---

## 8. API Design

- **API Paradigm**:  
  A **RESTful API** is recommended for the platform.

---

## 9. Database Design (ERD)

- Refer to the entity-relationship document.
