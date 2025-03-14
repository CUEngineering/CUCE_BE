# Product Requirements Document: CU Course Enrollment Platform

## 1. Executive Summary

The CU Course Enrollment Platform is a specialized system designed to streamline the course enrollment process at the university. The platform manages the complete enrollment lifecycle, from program and course creation to student registration and approval workflows. By digitalizing and automating this process, the university aims to improve efficiency, reduce administrative burden, and enhance the student experience.

The system serves three distinct user types—Administrators, Registrars, and Students—each with clearly defined roles and permissions tailored to their responsibilities within the enrollment process.

## 2. Product Overview

### 2.1 Purpose and Vision

The CU Course Enrollment Platform transforms the traditional enrollment process into a streamlined, transparent, and user-friendly experience. The system aims to:

- Centralize course and program management
- Automate enrollment workflows and approvals
- Enforce consistent rules around course capacity and eligibility
- Provide clarity to students about available courses and their enrollment status
- Create a clear division of responsibilities between administrators and registrars

### 2.2 Target Users

1. **Administrators**: Academic staff responsible for managing the overall course catalog, program structure, and session configuration
2. **Registrars**: Staff responsible for reviewing and processing student enrollment requests
3. **Students**: University students seeking to enroll in courses each academic session

### 2.3 Business Goals

- Reduce administrative overhead in managing course enrollments
- Increase enrollment completion rates before deadlines
- Ensure fair and consistent application of enrollment rules
- Improve student satisfaction with the enrollment process
- Maintain academic integrity through proper enrollment validation

## 3. System Structure and Relationships

### 3.1 Core Entities

#### 3.1.1 Programs

- Representation of a complete academic program (e.g., BA in English, MS in Computer Science)
- Contains multiple courses as requirements
- Has a defined type (Undergraduate, Graduate, Masters, Doctorate)
- Requires a specific number of credits for completion

#### 3.1.2 Courses

- Individual academic offerings
- Associated with one or more programs
- Have a set credit value
- Categorized by type (Undergraduate, Graduate, Masters, Doctorate)
- Have fixed class capacity limits based on course type

#### 3.1.3 Sessions

- Defined academic periods (e.g., semesters, quarters)
- Have specific start dates, end dates, and enrollment deadlines
- Contains open courses available for enrollment
- Only one session can be active at any given time

#### 3.1.4 Enrollments

- Represent a student's request to participate in a specific course
- Have various statuses (pending, approved, rejected)
- May include special requests for closed courses
- Assigned to registrars for processing

### 3.2 Key Relationships

- Students have a one-to-one relationship with programs
- Programs contain many courses
- Courses can belong to multiple programs
- Sessions contain multiple available courses
- Students can create multiple enrollments within a session
- Once a registrar processes one enrollment for a student in a session, all other enrollments by that student in that same session are assigned to that registrar

## 4. Detailed User Functionality

### 4.1 Administrator Functionality

#### 4.1.1 User Management

- **Login Access**: Secure authentication to the platform
- **Registrar Management**:
  - View all registrars in the system
  - Invite new registrars via email
  - Monitor registrar activities and workload
- **Student Management**:
  - View all students in the system
  - Invite students to the platform by entering:
    - Student ID
    - Email address
    - Assigned program
  - Add students to specific sessions
  - View student enrollment history and program information

#### 4.1.2 Program Management

- **Program Creation**:
  - Define program type (Undergraduate, Graduate, Masters, Doctorate)
  - Set program name
  - Establish required credit total
  - Identify required courses
- **Program Maintenance**:
  - View comprehensive list of all programs
  - Edit program details (type, name, required credits)
  - Add courses to programs
  - Remove courses from programs
- **Program Analytics**:
  - View detailed program information
  - Track total students enrolled per program
  - Monitor total courses and credits in each program

#### 4.1.3 Course Management

- **Course Creation**:
  - Define course type (which determines capacity limits)
  - Set course name and code
  - Establish credit value
- **Course Administration**:
  - View all courses in the system
  - Edit course details as needed
  - View detailed course analytics
- **Course Metrics**:
  - Track number of programs associated with each course
  - Monitor session participation
  - View enrollment statistics
  - Review student enrollment history by course

#### 4.1.4 Session Management

- **Session Creation**:
  - Set session start and end dates
  - Establish enrollment deadline
  - Configure session name
- **Session Configuration**:
  - Add eligible students to the session
  - Open specific courses for the session
  - Close courses manually if needed
- **Session Control**:
  - Start a new session (automatically closes any active session)
  - Close active sessions
  - Delete sessions (if applicable)
  - Remove students from sessions if needed
- **Session Monitoring**:
  - View all sessions and their status
  - Review detailed session information
  - Track enrollment progress during active sessions

#### 4.1.5 Enrollment Management

- **Enrollment Overview**:
  - View all enrollments (unassigned, personally assigned, or all registrars)
  - Track enrollment status across the system
- **Enrollment Processing**:
  - Approve standard enrollment requests
  - Reject standard enrollment requests (selecting from reason dropdown)
  - Approve special requests for closed courses
  - Reject special requests for closed courses (with reason)
- **Enrollment Details**:
  - View student information for each enrollment
  - See program affiliation
  - Check assigned registrar (if any)
  - Review enrollment history

### 4.2 Registrar Functionality

#### 4.2.1 Account Setup

- **Invitation Process**:
  - Receive email invitation to join the platform after admin invites them by entering their email
  - Click on invitation link to access the account set up page
- **Registration Completion**:
  - Upload profile picture
  - Provide first and last name
  - Create password
  - Complete account setup
- **System Access**:
  - Secure login to the platform using email and password

#### 4.2.2 Enrollment Management

- **Enrollment Queue**:
  - View unassigned enrollments awaiting processing
  - View enrollments specifically assigned to them
- **Enrollment Processing**:
  - Approve standard enrollment requests
  - Reject standard enrollments (selecting from reason dropdown)
  - Approve special requests for closed courses
  - Reject special requests for closed courses (with reason)
- **Assignment Logic**:
  - System automatically assigns all of a student's enrollments in a session to the registrar who first processes any of that student's enrollments

#### 4.2.3 Process Enforcement

- Follow university policies regarding enrollment approval
- Provide appropriate rejection reasons from the dropdown:
  - Outstanding balance
  - Class already taken
  - Class at capacity
  - Other reasons (with custom explanation)

### 4.3 Student Functionality

#### 4.3.1 Account Setup

- **Invitation Process**:
  - Receive email invitation to join the platform (after admin creates their account with student ID, email, and program)
  - Click on invitation link to access the registration page
- **Registration Completion**:
  - Upload profile picture
  - Provide first and last name
  - Create password
  - Complete account setup
- **System Access**:
  - Secure login to the platform using email and password

#### 4.3.2 Course Discovery

- **Course Browsing**:
  - View all courses opened for the current session that are part of the student's program
  - See courses even if they are now closed due to capacity limits
  - Filter and sort available courses
- **Course Information**:
  - View detailed course information
  - See course status (open or closed)
  - Review credit values and course codes
  - Read course descriptions

#### 4.3.3 Enrollment Actions

- **Standard Enrollment**:
  - Enroll in courses that are currently open
  - Submit requests before the enrollment deadline
- **Special Requests**:
  - Request enrollment in courses that have reached capacity
  - Provide justification for special enrollment requests if required
- **Re-enrollment Options**:
  - Re-enroll in courses that were previously rejected (if still open)
  - Submit new requests for closed courses that were previously rejected

#### 4.3.4 Enrollment Tracking

- **Enrollment Status**:
  - View list of all enrollment requests for current session
  - Check status of each enrollment (pending, approved, rejected)
  - See reasons for rejection when applicable
- **Registrar Interaction**:
  - View assigned registrar information
  - Contact assigned registrar via email if needed

#### 4.3.5 Personal Dashboard

- **My Hub Interface**:
  - View approved courses for current session by default
  - Select other sessions to view historical enrollments
  - Track academic progress through the program

## 5. Workflow Processes

### 5.1 Session Lifecycle

1. **Session Creation**:

   - Admin creates a new session with defined parameters
   - Admin sets start date, end date, and enrollment deadline

2. **Session Preparation**:

   - Admin adds eligible students to the session
   - Admin opens specific courses for the session
   - System enforces capacity limits based on course type

3. **Session Activation**:

   - Admin starts the session
   - Any previously active session is automatically closed
   - Students receive notification that enrollment is open

4. **Active Session Period**:

   - Students browse and enroll in available courses
   - Registrars process enrollment requests
   - Courses automatically close when capacity is reached
   - Students can request enrollment in closed courses

5. **Session Closure**:
   - Enrollment period ends at the deadline
   - Students can no longer create new enrollments
   - Registrars complete processing of pending requests
   - Admin may manually close the session or it closes automatically when a new session starts

### 5.2 Student Onboarding Workflow

1. **Initial Invitation**:

   - Admin enters student information (student ID, email, program)
   - System generates and sends invitation email to student

2. **Account Registration**:

   - Student receives email with invitation link
   - Student clicks link and accesses registration page
   - Student completes profile by adding:
     - Profile picture
     - First name
     - Last name
     - Password

3. **Account Activation**:
   - Student account becomes active upon completion of registration
   - Student can now log in to access the platform
   - Student is ready to be added to sessions

### 5.3 Enrollment Workflow

1. **Enrollment Creation**:

   - Student browses available courses for their program
   - Student submits enrollment request for open course or special request for closed course

   - **System Validation**:
     - Before creating a new enrollment, the system checks if the student already has a non-rejected enrollment for the same course and session.
     - If a non-rejected enrollment exists, the system prevents the student from creating a duplicate enrollment.
     - If the previous enrollment was rejected, the system allows the student to re-enroll.
   - The system creates an enrollment record with a `Pending` status.

2. **Registrar Assignment**:

   - New enrollments appear in the unassigned queue
   - Available to all registrars
   - Once a registrar processes one enrollment for a student, all other enrollments by that student in the same session are assigned to that registrar

3. **Enrollment Processing**:

   - Registrar reviews enrollment details
   - Registrar approves or rejects the enrollment
   - If rejecting, registrar selects a reason from the dropdown
   - For "Other" reasons, registrar must provide a custom explanation

4. **Notification and Follow-up**:
   - Student receives email notification of decision
   - If rejected, email includes the reason
   - Student can view updated enrollment status in their dashboard
   - Student may re-enroll (if course still open) or submit special request (if course closed)

### 5.4 Special Request Handling

1. **Request Submission**:

   - Student identifies a closed course they wish to join
   - Student submits special enrollment request
   - System marks enrollment as a special request

2. **Request Review**:

   - Admin or assigned registrar reviews the special request
   - Reviews course capacity constraints
   - Considers student's justification if provided

3. **Decision Process**:
   - Admin/registrar approves request (overriding capacity limits) or rejects request
   - If rejecting, appropriate reason is selected
   - Student is notified of the decision

## 6. Technical Requirements

### 6.1 System Architecture

- Web-based application with responsive design
- Secure authentication and authorization system
- Role-based access control for three user types
- Database to store all program, course, session, and enrollment data
- Email notification system

### 6.2 Performance Requirements

- Support for concurrent users during peak enrollment periods
- Quick response times for all operations
- Capable of handling the entire university student population
- Efficient processing of enrollment requests

### 6.3 Security Requirements

- Secure user authentication
- Role-based permission enforcement
- Data encryption for sensitive information
- Audit logs for all enrollment decisions
- Compliance with university data protection policies

### 6.4 Integration Points

- Email system for notifications and invitations
- Potential integration with existing university systems
- Exportable reports for administrative purposes

### 6.5 Enrollment Constraints

- **Duplicate Enrollment Prevention**:
  - The system enforces a rule that a student cannot have more than one non-rejected enrollment for the same course and session.
  - This is implemented using a **unique database constraint** on the `Enrollment` table for `(StudentID, CourseID, SessionID)` where `Status != 'Rejected'`.
  - The application also performs a validation check before creating a new enrollment to ensure compliance with this rule.

## 7. Key Metrics and KPIs

### 7.1 Operational Metrics

- **Enrollment Completion Rate**: Percentage of eligible students who complete enrollment before the deadline
- **Processing Time**: Average time for enrollment requests to be processed
- **Rejection Rate**: Percentage of enrollments rejected, categorized by reason
- **Course Popularity**: Enrollment numbers vs. capacity for each course
- **Registrar Workload**: Number of enrollments processed per registrar

### 7.2 System Performance Metrics

- **System Uptime**: Especially during critical enrollment periods
- **Response Time**: Average page load and transaction processing times
- **Error Rate**: Frequency of system errors or failed operations
- **User Satisfaction**: Feedback from all user types on system usability

### 7.3 Academic Metrics

- **Program Enrollment Distribution**: Spread of students across different programs
- **Course Utilization**: Percentage of course capacity utilized
- **Special Request Approval Rate**: Percentage of closed course requests approved
- **Student Engagement**: Percentage of students actively enrolling in each session

## 8. Implementation Considerations

### 8.1 Phased Rollout Approach

1. **Phase 1**: Core system with basic enrollment functionality
2. **Phase 2**: Advanced features and optimizations
3. **Phase 3**: Integrations with other university systems

### 8.2 Training Requirements

- Administrator training on system configuration
- Registrar training on enrollment processing
- Student orientation for using the enrollment system

### 8.3 Support Structure

- Technical support for all user types
- Documentation and help resources
- Feedback mechanism for continuous improvement

## 9. Future Enhancements

### 9.1 Potential Feature Additions

- Advanced analytics dashboard
- Automated prerequisite checking
- Waitlist functionality for popular courses
- Mobile application for students
- Calendar integration for course schedules
- Degree audit integration

### 9.2 Scalability Considerations

- Support for multiple simultaneous active sessions
- Cross-program enrollment options
- Integration with payment systems for course fees
- Support for special program types and non-standard enrollment rules
