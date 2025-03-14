## Entity-Relationship Diagram (ERD)

### Entities and Attributes

#### 1. Program

- `ProgramID` (PK)
- `ProgramName`
- `ProgramType` (Undergraduate, Graduate, Doctorate)
- `RequiredCredits`

#### 2. Course

- `CourseID` (PK)
- `CourseName`
- `CourseCode`
- `CreditValue`
- `CourseType` (Undergraduate, Graduate, Doctorate)
- `DefaultCapacity` (Base capacity before session adjustments)

#### 3. Session

- `SessionID` (PK)
- `SessionName`
- `StartDate`
- `EndDate`
- `EnrollmentDeadline`
- `Status` (Upcoming/Active/Closed)

#### 4. Student

- `StudentID` (PK)
- `FirstName`
- `LastName`
- `Email`
- `ProfilePicture`
- `ProgramID` (FK to **Program**)

#### 5. Registrar

- `RegistrarID` (PK)
- `FirstName`
- `LastName`
- `Email`
- `ProfilePicture`

#### 6. Enrollment

- `EnrollmentID` (PK)
- `StudentID` (FK to **Student**)
- `CourseID` (FK to **Course**)
- `SessionID` (FK to **Session**)
- `RegistrarID` (FK to **Registrar**)
- `Status` (Pending/Approved/Rejected)
- `SpecialRequest` (Boolean)
- `RejectionReason` (If **Status** is Rejected)
- `CreatedAt` (Timestamp)

#### 7. ProgramCourse (Junction Table)

- `ProgramID` (FK to **Program**)
- `CourseID` (FK to **Course**)
- **Composite PK**: (`ProgramID`, `CourseID`)

#### 8. SessionCourse (Junction Table)

- `SessionID` (FK to **Session**)
- `CourseID` (FK to **Course**)
- `Status` (Open/Closed)
- `AdjustedCapacity` (Capacity for this course in this session)
- **Composite PK**: (`SessionID`, `CourseID`)

#### 9. Invitation

- `InvitationID` (PK)
- `Email` (Unique constraint for non-expired invites)
- `Token` (Unique)
- `ExpiresAt` (Timestamp)
- `Status` (Pending/Accepted/Expired)
- `UserType` (Student/Registrar)
- `StudentID` (FK to **Student**, nullable)
- `RegistrarID` (FK to **Registrar**, nullable)
- `CreatedAt` (Timestamp)

---

### Relationships

1. **Program – Course**

   - **Type**: Many-to-Many (M:N) via **ProgramCourse**.
   - **Description**: A program includes many courses, and a course can belong to multiple programs.

2. **Session – Course**

   - **Type**: Many-to-Many (M:N) via **SessionCourse**.
   - **Description**: A session offers many courses, and a course can be offered in multiple sessions.

3. **Student – Program**

   - **Type**: Many-to-One (N:1).
   - **Description**: A student belongs to one program; a program has many students.

4. **Student – Enrollment**

   - **Type**: One-to-Many (1:N).
   - **Description**: A student can have multiple enrollments.

5. **Course – Enrollment**

   - **Type**: One-to-Many (1:N).
   - **Description**: A course can have multiple enrollments.

6. **Session – Enrollment**

   - **Type**: One-to-Many (1:N).
   - **Description**: A session can have multiple enrollments.

7. **Registrar – Enrollment**

   - **Type**: One-to-Many (1:N).
   - **Description**: A registrar processes multiple enrollments.

---

### Key Notes

1. **ProgramCourse**:

   - Resolves the many-to-many relationship between **Program** and **Course**.
   - Tracks which courses are part of which programs.

2. **SessionCourse**:

   - Resolves the many-to-many relationship between **Session** and **Course**.
   - Tracks session-specific details like `AdjustedCapacity` and `Status`.
   - `Status` ensures courses can be manually closed by admins

3. **Enrollment**:

   - Tracks all enrollment attempts, including rejections and re-enrollments.
   - Links a student to a course in a specific session.
   - `RegistrarID` enforces the rule that once a registrar processes one enrollment for a student in a session, all other enrollments for that student in the same session are assigned to the same registrar.

4. **RejectionReason**:

   - Provides a dropdown of predefined reasons (e.g., "Class at capacity").
   - Allows custom explanations for "Other" reasons.

5. **Unique Constraint**:
   - A unique index on `(StudentID, CourseID, SessionID)` where `Status != 'Rejected'` ensures no duplicate enrollments.
   - Prevent duplicate invites for the same StudentID, RegistrarID, or Email unless the existing invite is expired.
