--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

-- Started on 2025-06-20 15:54:41

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0; -- Corrected: Commented out.
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4914 (class 1262 OID 32895)
-- Name: sealed_nectar_academy_cbt; Type: DATABASE; Schema: -; Owner: sealed_nectar_academy
--

-- CREATE DATABASE sealed_nectar_academy_cbt WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_Nigeria.1252'; -- Corrected: Already commented out.


-- ALTER DATABASE sealed_nectar_academy_cbt OWNER TO sealed_nectar_academy; -- Corrected: Already commented out.

-- \connect sealed_nectar_academy_cbt -- Corrected: Already commented out.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0; -- Corrected: This was the second instance, now commented out.
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 233 (class 1255 OID 49518)
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


-- ALTER FUNCTION public.trigger_set_timestamp() OWNER TO postgres; -- Corrected: Commented out.

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 228 (class 1259 OID 32980)
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    class_id integer NOT NULL,
    class_name character varying(50) NOT NULL,
    teacher_id integer
);


-- ALTER TABLE public.classes OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 227 (class 1259 OID 32979)
-- Name: classes_class_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_class_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.classes_class_id_seq OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 4916 (class 0 OID 0)
-- Dependencies: 227
-- Name: classes_class_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

-- ALTER SEQUENCE public.classes_class_id_seq OWNED BY public.classes.class_id; -- Corrected: Commented out.


--
-- TOC entry 226 (class 1259 OID 32957)
-- Name: exam_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_results (
    result_id integer NOT NULL,
    student_id integer,
    exam_id integer,
    score numeric(5,2) NOT NULL,
    submission_date timestamp without time zone DEFAULT now(),
    answers jsonb,
    raw_score_obtained numeric(5,2),
    user_id integer,
    time_taken_seconds integer,
    total_possible_marks integer,
    exam_version_timestamp timestamp with time zone
);


-- ALTER TABLE public.exam_results OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 225 (class 1259 OID 32956)
-- Name: exam_results_result_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_results_result_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.exam_results_result_id_seq OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 4918 (class 0 OID 0)
-- Dependencies: 225
-- Name: exam_results_result_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

-- ALTER SEQUENCE public.exam_results_result_id_seq OWNED BY public.exam_results.result_id; -- Corrected: Commented out.


--
-- TOC entry 224 (class 1259 OID 32940)
-- Name: exam_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_sessions (
    session_id integer NOT NULL,
    student_id integer,
    exam_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    user_id integer,
    answers jsonb,
    progress jsonb,
    time_remaining_seconds integer
);


-- ALTER TABLE public.exam_sessions OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 223 (class 1259 OID 32939)
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.exam_sessions_session_id_seq OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 4920 (class 0 OID 0)
-- Dependencies: 223
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

-- ALTER SEQUENCE public.exam_sessions_session_id_seq OWNED BY public.exam_sessions.session_id; -- Corrected: Commented out.


--
-- TOC entry 220 (class 1259 OID 32912)
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    exam_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    created_by integer,
    class_level character varying(50),
    class_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    start_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp with time zone,
    subject_id integer,
    exam_type character varying(50) DEFAULT 'MAIN_EXAM'::character varying NOT NULL,
    max_score integer DEFAULT 100 NOT NULL,
    term character varying(50),
    session character varying(50),
    is_locked boolean DEFAULT false NOT NULL,
    CONSTRAINT exams_exam_type_check CHECK (((exam_type)::text = ANY ((ARRAY['CA1'::character varying, 'CA2'::character varying, 'CA3'::character varying, 'CA4'::character varying, 'MID_TERM'::character varying, 'MAIN_EXAM'::character varying, 'OTHER_CA'::character varying])::text[]))),
    CONSTRAINT exams_term_check CHECK (((term)::text = ANY ((ARRAY['FIRST'::character varying, 'SECOND'::character varying, 'THIRD'::character varying])::text[])))
);


-- ALTER TABLE public.exams OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 219 (class 1259 OID 32911)
-- Name: exams_exam_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exams_exam_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.exams_exam_id_seq OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 4922 (class 0 OID 0)
-- Dependencies: 219
-- Name: exams_exam_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

-- ALTER SEQUENCE public.exams_exam_id_seq OWNED BY public.exams.exam_id; -- Corrected: Commented out.


--
-- TOC entry 222 (class 1259 OID 32926)
-- Name: questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.questions (
    question_id integer NOT NULL,
    exam_id integer,
    question_text text NOT NULL,
    option_a character varying(255),
    option_b character varying(255),
    option_c character varying(255),
    option_d character varying(255),
    correct_answer character(1) NOT NULL,
    options jsonb,
    explanation text,
    marks integer DEFAULT 1 NOT NULL,
    user_id integer
);


-- ALTER TABLE public.questions OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 221 (class 1259 OID 32925)
-- Name: questions_question_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.questions_question_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.questions_question_id_seq OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 4924 (class 0 OID 0)
-- Dependencies: 221
-- Name: questions_question_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

-- ALTER SEQUENCE public.questions_question_id_seq OWNED BY public.questions.question_id; -- Corrected: Commented out.


--
-- TOC entry 232 (class 1259 OID 49501)
-- Name: report_card_meta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.report_card_meta (
    report_id integer NOT NULL,
    student_id integer NOT NULL,
    term character varying(10) NOT NULL,
    session character varying(9) NOT NULL,
    teacher_comment text,
    principal_comment text,
    next_term_begins date,
    class_position character varying(10),
    affective_domain jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


-- ALTER TABLE public.report_card_meta OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 231 (class 1259 OID 49500)
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.report_card_meta_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.report_card_meta_report_id_seq OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 4926 (class 0 OID 0)
-- Dependencies: 231
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

-- ALTER SEQUENCE public.report_card_meta_report_id_seq OWNED BY public.report_card_meta.report_id; -- Corrected: Commented out.


--
-- TOC entry 230 (class 1259 OID 33039)
-- Name: subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subjects (
    subject_id integer NOT NULL,
    name character varying(255) NOT NULL,
    subject_code character varying(50)
);


-- ALTER TABLE public.subjects OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 229 (class 1259 OID 33038)
-- Name: subjects_subject_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subjects_subject_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.subjects_subject_id_seq OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 4928 (class 0 OID 0)
-- Dependencies: 229
-- Name: subjects_subject_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

-- ALTER SEQUENCE public.subjects_subject_id_seq OWNED BY public.subjects.subject_id; -- Corrected: Commented out.


--
-- TOC entry 218 (class 1259 OID 32898)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_admin boolean DEFAULT false,
    role character varying(20) DEFAULT 'student'::character varying NOT NULL,
    admission_number character varying(50),
    class_level character varying(50),
    first_name character varying(255),
    last_name character varying(255),
    profile_picture_url text,
    dob date,
    gender character varying(10),
    updated_at timestamp without time zone,
    CONSTRAINT class_level_for_students_only CHECK (((((role)::text = 'student'::text) AND (class_level IS NOT NULL) AND ((class_level)::text <> ''::text)) OR (((role)::text <> 'student'::text) AND (class_level IS NULL))))
);


-- ALTER TABLE public.users OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 217 (class 1259 OID 32897)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.users_id_seq OWNER TO postgres; -- Corrected: Commented out.

--
-- TOC entry 4930 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

-- ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id; -- Corrected: Commented out.


--
-- TOC entry 4694 (class 2604 OID 32983)
-- Name: classes class_id; Type: DEFAULT; Schema: public; Owner: postgres
--

-- ALTER TABLE ONLY public.classes ALTER COLUMN class_id SET DEFAULT nextval('public.classes_class_id_seq'::regclass); -- Corrected: Commented out.


--
-- TOC entry 4692 (class 2604 OID 32960)
-- Name: exam_results result_id; Type: DEFAULT; Schema: public; Owner: postgres
--

-- ALTER TABLE ONLY public.exam_results ALTER COLUMN result_id SET DEFAULT nextval('public.exam_results_result_id_seq'::regclass); -- Corrected: Commented out.


--
-- TOC entry 4691 (class 2604 OID 32943)
-- Name: exam_sessions session_id; Type: DEFAULT; Schema: public; Owner: postgres
--

-- ALTER TABLE ONLY public.exam_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.exam_sessions_session_id_seq'::regclass); -- Corrected: Commented out.


--
-- TOC entry 4682 (class 2604 OID 32915)
-- Name: exams exam_id; Type: DEFAULT; Schema: public; Owner: postgres
--

-- ALTER TABLE ONLY public.exams ALTER COLUMN exam_id SET DEFAULT nextval('public.exams_exam_id_seq'::regclass); -- Corrected: Commented out.


--
-- TOC entry 4689 (class 2604 OID 32929)
-- Name: questions question_id; Type: DEFAULT; Schema: public; Owner: postgres
--

-- ALTER TABLE ONLY public.questions ALTER COLUMN question_id SET DEFAULT nextval('public.questions_question_id_seq'::regclass); -- Corrected: Commented out.


--
-- TOC entry 4696 (class 2604 OID 49504)
-- Name: report_card_meta report_id; Type: DEFAULT; Schema: public; Owner: postgres
--

-- ALTER TABLE ONLY public.report_card_meta ALTER COLUMN report_id SET DEFAULT nextval('public.report_card_meta_report_id_seq'::regclass); -- Corrected: Commented out.


--
-- TOC entry 4695 (class 2604 OID 33042)
-- Name: subjects subject_id; Type: DEFAULT; Schema: public; Owner: postgres
--

-- ALTER TABLE ONLY public.subjects ALTER COLUMN subject_id SET DEFAULT nextval('public.subjects_subject_id_seq'::regclass); -- Corrected: Commented out.


--
-- TOC entry 4678 (class 2604 OID 32901)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

-- ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass); -- Corrected: Commented out.


--
-- TOC entry 4904 (class 0 OID 32980)
-- Dependencies: 228
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4902 (class 0 OID 32957)
-- Dependencies: 226
-- Data for Name: exam_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.exam_results VALUES (4, 18, 16, 50.00, '2025-06-16 23:58:31.670222', '{"36": "d", "37": "d"}', 5.00, NULL, 20, NULL, NULL);
INSERT INTO public.exam_results VALUES (5, 18, 15, 0.00, '2025-06-17 21:25:55.91904', '{"39": "d", "40": "d"}', 0.00, NULL, 15, 10, NULL);


--
-- TOC entry 4900 (class 0 OID 32940)
-- Dependencies: 224
-- Data for Name: exam_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.exam_sessions VALUES (7, 18, 15, '2025-06-08 12:53:18.025212', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.exam_sessions VALUES (8, NULL, 16, '2025-06-09 07:36:37.302021', '2025-06-16 23:58:31.670222', 18, NULL, NULL, NULL);
INSERT INTO public.exam_sessions VALUES (13, NULL, 15, '2025-06-14 00:07:56.177178', '2025-06-17 21:25:55.91904', 18, NULL, NULL, NULL);


--
-- TOC entry 4896 (class 0 OID 32912)
-- Dependencies: 220
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.exams VALUES (16, 'Mathematics MD TERM TEST', 'Read carefully before answering', 5, 6, 'Primary 1', NULL, '2025-06-09 07:11:53.422502+01', '2025-06-09 07:11:53.422502+01', '2025-06-09 07:11:53.422502+01', NULL, 1, 'CA1', 10, 'FIRST', '2025-2026', false);
INSERT INTO public.exams VALUES (15, 'Mathematics MD TERM TEST', 'ATTEMPT ALL', 5, 1, 'Primary 1', NULL, '2025-06-08 12:22:26.201653+01', '2025-06-17 21:36:17.824943+01', '2025-06-08 12:22:26.201653+01', NULL, 1, 'CA2', 10, 'FIRST', '2025-2026', true);


--
-- TOC entry 4898 (class 0 OID 32926)
-- Dependencies: 222
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.questions VALUES (36, 16, 'i have 8 oranges, if i share it between 4 of my brothers, how many should each receive?', '1', '3', '2', '4', 'C', NULL, '', 5, NULL);
INSERT INTO public.questions VALUES (37, 16, 'find the difference between 37 and 27', '64', '0', '40', '10', 'D', NULL, '', 5, NULL);
INSERT INTO public.questions VALUES (41, 15, '23 + 7 is', '70', '12', '35', '30', 'B', NULL, '', 7, NULL);
INSERT INTO public.questions VALUES (42, 15, '3 X 15', '20', '45', '315', '35', 'B', NULL, '', 3, NULL);


--
-- TOC entry 4908 (class 0 OID 49501)
-- Dependencies: 232
-- Data for Name: report_card_meta; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4906 (class 0 OID 33039)
-- Dependencies: 230
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subjects VALUES (1, 'Mathematics', 'MTH');
INSERT INTO public.subjects VALUES (2, 'English Language', 'ENG');
INSERT INTO public.subjects VALUES (3, 'Basic Science', 'BSC');
INSERT INTO public.subjects VALUES (4, 'Social Studies', 'SOS');
INSERT INTO public.subjects VALUES (9, 'Computer Studies', 'CMP');
INSERT INTO public.subjects VALUES (10, 'Civic Education', 'CVE');
INSERT INTO public.subjects VALUES (11, 'Islamic Studies', 'IRS');


--
-- TOC entry 4894 (class 0 OID 32898)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES (6, 'Abdullah', 'ishola2023m@gmail.com', '$2a$12$U4m7dPwPghPXVABPRIpadONJNoJGkP2cqvfr7lNhL3HTBpIfR4JNC', '2025-06-02 12:54:01.221605', true, 'admin', NULL, NULL, 'Abdullah', 'Abdlateef', NULL, NULL, NULL, NULL);
INSERT INTO public.users VALUES (1, 'Abu Sumayah', 'sealednec@gmail.com', '$2a$12$nIZdi0XoJ9eScF7MD/o62e3p37FP058dJ63tCEltSvUrG5EVrkx16', '2025-06-01 22:42:59.865333', true, 'admin', NULL, NULL, 'Abu', 'Sumayah', NULL, NULL, NULL, NULL);
INSERT INTO public.users VALUES (15, 'khadijah', 'abdlateefkhadijah@gmail.com', '$2b$10$zQG388LFxfkrRXEjfDThB.Y.NoWjQYzyjJPK1oKXkquL0RFiVWKKW', '2025-06-05 15:22:56.261559', false, 'teacher', NULL, NULL, 'khadijah', 'Abdlateef', NULL, NULL, NULL, NULL);
INSERT INTO public.users VALUES (18, 'Atiyah', 'ijh@gmail.com', '$2b$10$7fSk2pBxNum4VxA3R41DFuZcv/ccpK3/WC7OmpbjG5DAmSu8KmoBW', '2025-06-08 12:20:06.023402', false, 'student', 'SNA/22/001', 'Primary 1', 'Atiyah', 'Abdulateef', NULL, '2015-02-11', 'Female', NULL);


--
-- TOC entry 4931 (class 0 OID 0)
-- Dependencies: 227
-- Name: classes_class_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_class_id_seq', 1, false);


--
-- TOC entry 4932 (class 0 OID 0)
-- Dependencies: 225
-- Name: exam_results_result_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_results_result_id_seq', 5, true);


--
-- TOC entry 4933 (class 0 OID 0)
-- Dependencies: 223
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_sessions_session_id_seq', 20, true);


--
-- TOC entry 4934 (class 0 OID 0)
-- Dependencies: 219
-- Name: exams_exam_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exams_exam_id_seq', 16, true);


--
-- TOC entry 4935 (class 0 OID 0)
-- Dependencies: 221
-- Name: questions_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.questions_question_id_seq', 42, true);


--
-- TOC entry 4936 (class 0 OID 0)
-- Dependencies: 231
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.report_card_meta_report_id_seq', 1, false);


--
-- TOC entry 4937 (class 0 OID 0)
-- Dependencies: 229
-- Name: subjects_subject_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subjects_subject_id_seq', 12, true);


--
-- TOC entry 4938 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 18, true);


--
-- TOC entry 4723 (class 2606 OID 32985)
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (class_id);


--
-- TOC entry 4719 (class 2606 OID 32963)
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (result_id);


--
-- TOC entry 4715 (class 2606 OID 32945)
-- Name: exam_sessions exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (session_id);


--
-- TOC entry 4711 (class 2606 OID 32919)
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (exam_id);


--
-- TOC entry 4713 (class 2606 OID 32933)
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (question_id);


--
-- TOC entry 4731 (class 2606 OID 49510)
-- Name: report_card_meta report_card_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_pkey PRIMARY KEY (report_id);


--
-- TOC entry 4733 (class 2606 OID 49512)
-- Name: report_card_meta report_card_meta_student_id_term_session_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_term_session_key UNIQUE (student_id, term, session);


--
-- TOC entry 4725 (class 2606 OID 33046)
-- Name: subjects subjects_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_name_key UNIQUE (name);


--
-- TOC entry 4727 (class 2606 OID 33044)
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (subject_id);


--
-- TOC entry 4729 (class 2606 OID 33048)
-- Name: subjects subjects_subject_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_subject_code_key UNIQUE (subject_code);


--
-- TOC entry 4721 (class 2606 OID 33020)
-- Name: exam_results unique_student_exam; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT unique_student_exam UNIQUE (student_id, exam_id);


--
-- TOC entry 4717 (class 2606 OID 41309)
-- Name: exam_sessions unique_user_exam_session; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT unique_user_exam_session UNIQUE (user_id, exam_id);


--
-- TOC entry 4703 (class 2606 OID 32978)
-- Name: users users_admission_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_admission_number_key UNIQUE (admission_number);


--
-- TOC entry 4705 (class 2606 OID 32910)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4707 (class 2606 OID 32906)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4709 (class 2606 OID 32908)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4747 (class 2620 OID 49519)
-- Name: exams set_exam_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_exam_timestamp BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- TOC entry 4745 (class 2606 OID 32986)
-- Name: classes classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- TOC entry 4742 (class 2606 OID 33079)
-- Name: exam_results exam_results_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 4743 (class 2606 OID 32964)
-- Name: exam_results exam_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- TOC entry 4744 (class 2606 OID 33104)
-- Name: exam_results exam_results_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4739 (class 2606 OID 33099)
-- Name: exam_sessions exam_sessions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 4740 (class 2606 OID 33094)
-- Name: exam_sessions exam_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4741 (class 2606 OID 33089)
-- Name: exam_sessions exam_sessions_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4734 (class 2606 OID 32991)
-- Name: exams exams_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(class_id);


--
-- TOC entry 4735 (class 2606 OID 33012)
-- Name: exams exams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4736 (class 2606 OID 33051)
-- Name: exams exams_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id);


--
-- TOC entry 4737 (class 2606 OID 33074)
-- Name: questions questions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 4738 (class 2606 OID 33109)
-- Name: questions questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4746 (class 2606 OID 49513)
-- Name: report_card_meta report_card_meta_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4915 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE classes; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON TABLE public.classes TO sealed_nectar_academy; -- Corrected: Commented out.


--
-- TOC entry 4917 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE exam_results; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON TABLE public.exam_results TO sealed_nectar_academy; -- Corrected: Commented out.


--
-- TOC entry 4919 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE exam_sessions; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON TABLE public.exam_sessions TO sealed_nectar_academy; -- Corrected: Commented out.


--
-- TOC entry 4921 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE exams; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON TABLE public.exams TO sealed_nectar_academy; -- Corrected: Commented out.


--
-- TOC entry 4923 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE questions; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON TABLE public.questions TO sealed_nectar_academy; -- Corrected: Commented out.


--
-- TOC entry 4925 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE report_card_meta; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON TABLE public.report_card_meta TO sealed_nectar_academy; -- Corrected: Commented out.


--
-- TOC entry 4927 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE subjects; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON TABLE public.subjects TO sealed_nectar_academy; -- Corrected: Commented out.


--
-- TOC entry 4929 (class 0 OID 0)
-- Dependencies: 218
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON TABLE public.users TO sealed_nectar_academy; -- Corrected: Commented out.


--
-- TOC entry 2080 (class 826 OID 32896)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO sealed_nectar_academy; -- Corrected: Commented out.


-- Completed on 2025-06-20 15:54:42

--
-- PostgreSQL database dump complete
--