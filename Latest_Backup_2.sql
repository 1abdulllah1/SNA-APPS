--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 17.2

-- Started on 2025-06-29 10:50:04

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: sna_db_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO sna_db_user;

--
-- TOC entry 248 (class 1255 OID 16434)
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: sna_db_user
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_set_timestamp() OWNER TO sna_db_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 215 (class 1259 OID 16435)
-- Name: class_levels; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.class_levels (
    level_id integer NOT NULL,
    level_name character varying(50) NOT NULL,
    teacher_id integer,
    level_code character varying(255)
);


ALTER TABLE public.class_levels OWNER TO sna_db_user;

--
-- TOC entry 236 (class 1259 OID 16670)
-- Name: classes; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.classes (
    class_id integer NOT NULL,
    name character varying(100) NOT NULL,
    class_code character varying(50) NOT NULL,
    level integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.classes OWNER TO sna_db_user;

--
-- TOC entry 216 (class 1259 OID 16438)
-- Name: classes_class_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.classes_class_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_class_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3527 (class 0 OID 0)
-- Dependencies: 216
-- Name: classes_class_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.classes_class_id_seq OWNED BY public.class_levels.level_id;


--
-- TOC entry 235 (class 1259 OID 16669)
-- Name: classes_class_id_seq1; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.classes_class_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_class_id_seq1 OWNER TO sna_db_user;

--
-- TOC entry 3528 (class 0 OID 0)
-- Dependencies: 235
-- Name: classes_class_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.classes_class_id_seq1 OWNED BY public.classes.class_id;


--
-- TOC entry 217 (class 1259 OID 16439)
-- Name: exam_results; Type: TABLE; Schema: public; Owner: sna_db_user
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
    exam_version_timestamp timestamp with time zone,
    submission_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.exam_results OWNER TO sna_db_user;

--
-- TOC entry 218 (class 1259 OID 16445)
-- Name: exam_results_result_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exam_results_result_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_results_result_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3529 (class 0 OID 0)
-- Dependencies: 218
-- Name: exam_results_result_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exam_results_result_id_seq OWNED BY public.exam_results.result_id;


--
-- TOC entry 234 (class 1259 OID 16627)
-- Name: exam_sections; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exam_sections (
    section_id integer NOT NULL,
    exam_id integer NOT NULL,
    section_order integer NOT NULL,
    title character varying(255) NOT NULL,
    instructions text,
    section_instructions text
);


ALTER TABLE public.exam_sections OWNER TO sna_db_user;

--
-- TOC entry 233 (class 1259 OID 16626)
-- Name: exam_sections_section_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exam_sections_section_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_sections_section_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3530 (class 0 OID 0)
-- Dependencies: 233
-- Name: exam_sections_section_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exam_sections_section_id_seq OWNED BY public.exam_sections.section_id;


--
-- TOC entry 219 (class 1259 OID 16446)
-- Name: exam_sessions; Type: TABLE; Schema: public; Owner: sna_db_user
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


ALTER TABLE public.exam_sessions OWNER TO sna_db_user;

--
-- TOC entry 220 (class 1259 OID 16451)
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exam_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_sessions_session_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3531 (class 0 OID 0)
-- Dependencies: 220
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exam_sessions_session_id_seq OWNED BY public.exam_sessions.session_id;


--
-- TOC entry 221 (class 1259 OID 16452)
-- Name: exams; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exams (
    exam_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    created_by integer,
    class_level character varying(50),
    class_level_id integer,
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
    exam_instructions text,
    CONSTRAINT exams_exam_type_check CHECK (((exam_type)::text = ANY (ARRAY[('CA1'::character varying)::text, ('CA2'::character varying)::text, ('CA3'::character varying)::text, ('CA4'::character varying)::text, ('MID_TERM'::character varying)::text, ('MAIN_EXAM'::character varying)::text, ('OTHER_CA'::character varying)::text]))),
    CONSTRAINT exams_term_check CHECK (((term)::text = ANY (ARRAY[('FIRST'::character varying)::text, ('SECOND'::character varying)::text, ('THIRD'::character varying)::text])))
);


ALTER TABLE public.exams OWNER TO sna_db_user;

--
-- TOC entry 222 (class 1259 OID 16465)
-- Name: exams_exam_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exams_exam_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exams_exam_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3532 (class 0 OID 0)
-- Dependencies: 222
-- Name: exams_exam_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exams_exam_id_seq OWNED BY public.exams.exam_id;


--
-- TOC entry 223 (class 1259 OID 16466)
-- Name: questions; Type: TABLE; Schema: public; Owner: sna_db_user
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
    user_id integer,
    section_id integer NOT NULL
);


ALTER TABLE public.questions OWNER TO sna_db_user;

--
-- TOC entry 224 (class 1259 OID 16472)
-- Name: questions_question_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.questions_question_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.questions_question_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3533 (class 0 OID 0)
-- Dependencies: 224
-- Name: questions_question_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.questions_question_id_seq OWNED BY public.questions.question_id;


--
-- TOC entry 225 (class 1259 OID 16473)
-- Name: report_card_meta; Type: TABLE; Schema: public; Owner: sna_db_user
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
    updated_at timestamp with time zone DEFAULT now(),
    cumulative_data jsonb,
    class_level character varying(255)
);


ALTER TABLE public.report_card_meta OWNER TO sna_db_user;

--
-- TOC entry 226 (class 1259 OID 16480)
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.report_card_meta_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.report_card_meta_report_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3534 (class 0 OID 0)
-- Dependencies: 226
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.report_card_meta_report_id_seq OWNED BY public.report_card_meta.report_id;


--
-- TOC entry 232 (class 1259 OID 16603)
-- Name: results; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.results (
    id integer NOT NULL,
    user_id integer,
    score integer,
    total integer,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.results OWNER TO sna_db_user;

--
-- TOC entry 231 (class 1259 OID 16602)
-- Name: results_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.results_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3535 (class 0 OID 0)
-- Dependencies: 231
-- Name: results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.results_id_seq OWNED BY public.results.id;


--
-- TOC entry 227 (class 1259 OID 16481)
-- Name: subjects; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.subjects (
    subject_id integer NOT NULL,
    name character varying(255) NOT NULL,
    subject_code character varying(50),
    class_level text,
    class_level_id integer
);


ALTER TABLE public.subjects OWNER TO sna_db_user;

--
-- TOC entry 228 (class 1259 OID 16484)
-- Name: subjects_subject_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.subjects_subject_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subjects_subject_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3536 (class 0 OID 0)
-- Dependencies: 228
-- Name: subjects_subject_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.subjects_subject_id_seq OWNED BY public.subjects.subject_id;


--
-- TOC entry 229 (class 1259 OID 16485)
-- Name: users; Type: TABLE; Schema: public; Owner: sna_db_user
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
    class_level_id integer,
    password_hash character varying(255),
    full_name character varying(255),
    CONSTRAINT class_level_for_students_only CHECK (((((role)::text = 'student'::text) AND (class_level IS NOT NULL) AND ((class_level)::text <> ''::text)) OR (((role)::text <> 'student'::text) AND (class_level IS NULL))))
);


ALTER TABLE public.users OWNER TO sna_db_user;

--
-- TOC entry 230 (class 1259 OID 16494)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3537 (class 0 OID 0)
-- Dependencies: 230
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3258 (class 2604 OID 16495)
-- Name: class_levels level_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels ALTER COLUMN level_id SET DEFAULT nextval('public.classes_class_id_seq'::regclass);


--
-- TOC entry 3283 (class 2604 OID 16673)
-- Name: classes class_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes ALTER COLUMN class_id SET DEFAULT nextval('public.classes_class_id_seq1'::regclass);


--
-- TOC entry 3259 (class 2604 OID 16496)
-- Name: exam_results result_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results ALTER COLUMN result_id SET DEFAULT nextval('public.exam_results_result_id_seq'::regclass);


--
-- TOC entry 3282 (class 2604 OID 16630)
-- Name: exam_sections section_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sections ALTER COLUMN section_id SET DEFAULT nextval('public.exam_sections_section_id_seq'::regclass);


--
-- TOC entry 3262 (class 2604 OID 16497)
-- Name: exam_sessions session_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.exam_sessions_session_id_seq'::regclass);


--
-- TOC entry 3263 (class 2604 OID 16498)
-- Name: exams exam_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams ALTER COLUMN exam_id SET DEFAULT nextval('public.exams_exam_id_seq'::regclass);


--
-- TOC entry 3270 (class 2604 OID 16499)
-- Name: questions question_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions ALTER COLUMN question_id SET DEFAULT nextval('public.questions_question_id_seq'::regclass);


--
-- TOC entry 3272 (class 2604 OID 16500)
-- Name: report_card_meta report_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta ALTER COLUMN report_id SET DEFAULT nextval('public.report_card_meta_report_id_seq'::regclass);


--
-- TOC entry 3280 (class 2604 OID 16606)
-- Name: results id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results ALTER COLUMN id SET DEFAULT nextval('public.results_id_seq'::regclass);


--
-- TOC entry 3275 (class 2604 OID 16501)
-- Name: subjects subject_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects ALTER COLUMN subject_id SET DEFAULT nextval('public.subjects_subject_id_seq'::regclass);


--
-- TOC entry 3276 (class 2604 OID 16502)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3500 (class 0 OID 16435)
-- Dependencies: 215
-- Data for Name: class_levels; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3521 (class 0 OID 16670)
-- Dependencies: 236
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3502 (class 0 OID 16439)
-- Dependencies: 217
-- Data for Name: exam_results; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exam_results VALUES (15, 20, 15, 100.00, '2025-06-22 17:40:17.5734', '{"83": "b", "84": "b"}', 10.00, NULL, 13, 10, '2025-06-22 17:39:27.487+00', '2025-06-23 21:09:57.288307+00');
INSERT INTO public.exam_results VALUES (16, 20, 20, 70.00, '2025-06-24 10:29:53.728775', '{"85": "c", "86": "c", "87": "a"}', 7.00, NULL, 38, 10, '2025-06-24 10:28:07.76+00', '2025-06-24 10:29:53.728775+00');
INSERT INTO public.exam_results VALUES (20, 22, 20, 30.00, '2025-06-24 10:45:08.077264', '{"85": "d", "86": "b", "87": "c"}', 3.00, NULL, 17, 10, '2025-06-24 10:28:07.76+00', '2025-06-24 10:45:08.077264+00');
INSERT INTO public.exam_results VALUES (21, 22, 18, 100.00, '2025-06-24 10:45:40.191628', '{"88": "d", "89": "a", "90": "c"}', 10.00, NULL, 24, 10, '2025-06-24 10:43:17.397+00', '2025-06-24 10:45:40.191628+00');
INSERT INTO public.exam_results VALUES (22, 22, 15, 70.00, '2025-06-24 10:45:59.09738', '{"83": "b", "84": "c"}', 7.00, NULL, 8, 10, '2025-06-22 17:39:27.487+00', '2025-06-24 10:45:59.09738+00');
INSERT INTO public.exam_results VALUES (12, 20, 18, 80.00, '2025-06-24 10:46:45.724755', '{"88": "c", "89": "a", "90": "c"}', 8.00, NULL, 21, 10, '2025-06-24 10:43:17.397+00', '2025-06-23 21:09:57.288307+00');
INSERT INTO public.exam_results VALUES (24, 20, 21, 80.00, '2025-06-24 11:06:16.534823', '{"96": "c", "97": "b", "98": "d", "99": "c", "100": "b"}', 16.00, NULL, 14, 20, '2025-06-24 11:05:15.589+00', '2025-06-24 11:01:55.364933+00');
INSERT INTO public.exam_results VALUES (25, 22, 21, 100.00, '2025-06-24 11:06:58.772468', '{"96": "b", "97": "a", "98": "d", "99": "c", "100": "b"}', 20.00, NULL, 27, 20, '2025-06-24 11:05:15.589+00', '2025-06-24 11:03:08.228121+00');


--
-- TOC entry 3519 (class 0 OID 16627)
-- Dependencies: 234
-- Data for Name: exam_sections; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exam_sections VALUES (3, 15, 1, 'General Questions', NULL, NULL);
INSERT INTO public.exam_sections VALUES (4, 20, 1, 'General Questions', NULL, NULL);
INSERT INTO public.exam_sections VALUES (5, 18, 1, 'General Questions', NULL, NULL);
INSERT INTO public.exam_sections VALUES (6, 21, 1, 'General Questions', NULL, NULL);
INSERT INTO public.exam_sections VALUES (7, 22, 1, 'General Questions', NULL, NULL);
INSERT INTO public.exam_sections VALUES (8, 23, 1, 'General Questions', NULL, NULL);


--
-- TOC entry 3504 (class 0 OID 16446)
-- Dependencies: 219
-- Data for Name: exam_sessions; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exam_sessions VALUES (7, 18, 15, '2025-06-08 12:53:18.025212', NULL, NULL, NULL, NULL, NULL);


--
-- TOC entry 3506 (class 0 OID 16452)
-- Dependencies: 221
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exams VALUES (15, 'Mathematics MD TERM TEST', 'ATTEMPT ALL', 2, 1, 'Primary 1', NULL, '2025-06-08 11:22:26.201653+00', '2025-06-22 17:39:27.487019+00', '2025-06-08 11:22:26.201653+00', NULL, 1, 'CA2', 10, 'FIRST', '2024-2025', false, NULL);
INSERT INTO public.exams VALUES (20, 'Maths', '', 2, 24, 'Primary 1', NULL, '2025-06-24 10:28:07.760573+00', '2025-06-25 21:56:52.171809+00', '2025-06-24 10:28:07.760573+00', NULL, 1, 'MAIN_EXAM', 10, 'FIRST', '2024-2025', false, NULL);
INSERT INTO public.exams VALUES (18, 'English C.A 1', 'Read the questions carefully and answer them correctly', 2, NULL, 'Primary 1', NULL, '2025-06-22 12:53:26.745533+00', '2025-06-26 10:58:16.003773+00', '2025-06-22 12:53:26.745533+00', NULL, 35, 'CA1', 10, 'FIRST', '2024-2025', false, NULL);
INSERT INTO public.exams VALUES (21, 'English', 'Lexis and structure alone', 3, 24, 'Primary 1', NULL, '2025-06-24 11:00:46.830572+00', '2025-06-27 11:47:45.38753+00', '2025-06-24 11:00:46.830572+00', NULL, 35, 'MAIN_EXAM', 20, 'FIRST', '2024-2025', false, NULL);
INSERT INTO public.exams VALUES (22, 'Th', '', 50, 30, 'JSS 1', NULL, '2025-06-28 01:11:42.903523+00', '2025-06-28 01:11:42.903523+00', '2025-06-28 01:11:42.903523+00', NULL, 24, 'CA4', 25, 'FIRST', '2025-2026', false, NULL);
INSERT INTO public.exams VALUES (23, 'Df', '', 55, 15, 'SS 1', NULL, '2025-06-28 01:13:16.567005+00', '2025-06-28 01:13:16.567005+00', '2025-06-28 01:13:16.567005+00', NULL, 54, 'OTHER_CA', 36, 'FIRST', '2024-2025', false, NULL);


--
-- TOC entry 3508 (class 0 OID 16466)
-- Dependencies: 223
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.questions VALUES (119, 20, 'What is the largest number', '229', '229.00', '229.001', '292', 'D', NULL, '', 3, NULL, 4);
INSERT INTO public.questions VALUES (120, 20, 'If I have 20 minutes to finish my cbt exam, I started by 3 o clock and the exam was to last for 50 minutes, what time is it now?', '3:50', '4 o clock', '3:30', '3:20', 'C', NULL, '', 6, NULL, 4);
INSERT INTO public.questions VALUES (121, 20, 'Add 5 and - 4, the rest is?', '1', '9', '-1', '5', 'A', NULL, '', 1, NULL, 4);
INSERT INTO public.questions VALUES (122, 21, 'She is a ______ person', 'Naice', 'Nice', 'Niece', 'Rice', 'B', NULL, '', 2, NULL, 6);
INSERT INTO public.questions VALUES (123, 21, 'Are we traveling ______ land or air', 'By', 'On', 'With', 'Using', 'A', NULL, '', 2, NULL, 6);
INSERT INTO public.questions VALUES (124, 21, 'Sule, Tunde,Marvelous and ___ are friends', 'Me', 'Us', 'We', '1', 'D', NULL, '', 2, NULL, 6);
INSERT INTO public.questions VALUES (125, 21, 'My mom, my dad, my siblings, and I ______ going to spend our holiday in the village', 'Are', 'Is', 'Am', 'None of the above', 'C', NULL, '', 13, NULL, 6);
INSERT INTO public.questions VALUES (126, 21, 'His brothers ______ people like murderers', 'Kills', 'Kill', 'Keel', 'Killing', 'B', NULL, '', 1, NULL, 6);
INSERT INTO public.questions VALUES (127, 22, 'C', '2', '3', 'C', '1', 'B', NULL, 'Because C is the 3rd letter of the alphabet ', 1, NULL, 7);
INSERT INTO public.questions VALUES (128, 23, 'Df', '10', 'Dif', '6', '4', 'A', NULL, 'It is very interesting to play ball', 19, NULL, 8);
INSERT INTO public.questions VALUES (83, 15, '23 + 7 is', '70', '12', '35', '30', 'B', NULL, '', 7, NULL, 3);
INSERT INTO public.questions VALUES (84, 15, '3 X 15', '20', '45', '315', '35', 'B', NULL, '', 3, NULL, 3);
INSERT INTO public.questions VALUES (88, 18, 'Fill in the gap with the appropriate option

You and _____ are not friends', 'Me', 'Them', 'Us', 'I', 'D', NULL, '', 2, NULL, 5);
INSERT INTO public.questions VALUES (89, 18, 'Wale, Sule and I _____ not going to work today', 'am', 'are', 'is', 'None of the options are correct', 'A', NULL, '', 6, NULL, 5);
INSERT INTO public.questions VALUES (90, 18, 'Choose the word that best describe the opposite of the quoted word


She was ''above'' in all her exam', 'Good', 'Best', 'Below', 'Poor', 'C', NULL, '', 2, NULL, 5);


--
-- TOC entry 3510 (class 0 OID 16473)
-- Dependencies: 225
-- Data for Name: report_card_meta; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3517 (class 0 OID 16603)
-- Dependencies: 232
-- Data for Name: results; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3512 (class 0 OID 16481)
-- Dependencies: 227
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.subjects VALUES (11, 'Islamic Studies', 'IRS-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (1, 'Mathematics', 'MTH-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (13, 'Civic education ', 'CIV-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (3, 'Basic Science', 'BST-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (9, 'Computer Studies', 'ICT-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (4, 'Social Studies', 'SOS-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (14, 'Yoruba', 'YOR-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (15, 'HOME ECONOMICS', 'H/ECONS-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (16, 'AGRICULTURAL SCIENCE', 'AGRIC-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (17, 'CREATIVE AND CULTURAL ARTS', 'CCA-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (18, 'PHYSICAL AND HEALTH EDUCATION ', 'PHE-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (19, 'HANDWRITING', 'H/W-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (20, 'ARABIC LANGUAGE', 'ARA-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (21, 'QURAN', 'QUR-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (22, 'LITERACY AND COMMUNICATION', 'LIT/COMM-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (23, 'NUMERACY/MATHS', 'N/M-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (24, 'ASS', 'ASS-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (25, 'SED', 'SED-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (26, 'SHD', 'SHD-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (27, 'CCA', 'CCA-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (28, 'CHL', 'CHL-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (29, 'H/WRITING', 'H/W-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (30, 'DISCOVERY', 'DIS-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (31, 'STORY', 'STO-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (32, 'PRE-SCIENCE', 'PRE-SC-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (33, 'S.T.L/F', 'STL/F-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (34, 'SONG AND RHYME', 'S/R-PS', NULL, NULL);
INSERT INTO public.subjects VALUES (35, 'ENGLISH LANGUAGE', 'ENG-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (2, 'ENGLISH STUDIES', 'ENG-PRY', NULL, NULL);
INSERT INTO public.subjects VALUES (36, 'MATHEMATICS', 'MATHS-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (37, 'CHEMISTRY', 'CHEM-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (38, 'PHYSICS', 'PHY-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (40, 'FURTHER MATHS', 'F/MATHS-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (41, 'TECHNICAL DRAWING', 'TD-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (42, 'CIVIC EDUCATION', 'CIV-SEC 2', NULL, NULL);
INSERT INTO public.subjects VALUES (43, 'ECONOMICS', 'ECONS-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (44, 'FINANCIAL ACCOUNT', 'F/ACC-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (45, 'COMMERCE', 'COMM-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (46, 'DATA PROCESSING ', 'DATA PRO-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (47, 'MARKETING', 'MKT-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (48, 'BOOK KEEPING', 'BK-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (39, 'BIOLOGY', 'BIO-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (49, 'YORUBA', 'YOR-SEC 2', NULL, NULL);
INSERT INTO public.subjects VALUES (50, 'IRS', 'IRS-SEC 2', NULL, NULL);
INSERT INTO public.subjects VALUES (51, 'LITERATURE-IN-ENGLISH', 'LIT-SEC', NULL, NULL);
INSERT INTO public.subjects VALUES (52, 'ENGLISH STDS', 'ENG-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (53, 'MATHS', 'MATHS-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (54, 'BST', 'BST-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (55, 'CIVIC EDUCATION ', 'CIV-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (56, 'BUSINESS STDS', 'BUS-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (57, 'AGRIC SCIENCE', 'AGRIC-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (58, 'HOME ECONS', 'H/ECONS-SEC1', NULL, NULL);
INSERT INTO public.subjects VALUES (59, 'PHE', 'PHE-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (66, 'CREATICE AND CULTURAL A', 'CCA-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (67, 'YORUBA LANGUAGE', 'YOR-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (68, 'ICT', 'ICT-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (70, 'QURAN STDS', 'QUR-SEC 1', NULL, NULL);
INSERT INTO public.subjects VALUES (69, 'ARABIC STUDIES ', 'ARA-SEC 1', NULL, NULL);


--
-- TOC entry 3514 (class 0 OID 16485)
-- Dependencies: 229
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.users VALUES (15, 'khadijah', 'abdlateefkhadijah@gmail.com', '$2b$10$zQG388LFxfkrRXEjfDThB.Y.NoWjQYzyjJPK1oKXkquL0RFiVWKKW', '2025-06-05 15:22:56.261559', false, 'teacher', NULL, NULL, 'khadijah', 'Abdlateef', 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', NULL, NULL, NULL, NULL, '$2b$10$2NGHTnaRfVUVb98EOBYpROxxGXvUPf9xN.4FX2MeTybqueuDMYU6G', 'Khadijah abdlateef ');
INSERT INTO public.users VALUES (26, 'MARYAM', 'maryam@gmail.com', '$2b$10$hfvFAnwWjE2f2Xp7cKCWVuRBoQpcFKffdFZO.fKpHuesgWk7bh8qi', '2025-06-28 00:54:47.228596', false, 'student', 'Sna/25/001', 'Primary 1', NULL, NULL, 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', '2020-04-08', 'Female', NULL, NULL, NULL, 'Maryam Abdlateef');
INSERT INTO public.users VALUES (27, 'Atiyah', 'atiyah@gmail.com', '$2b$10$6/j/62KU5oTxrMv6ytYs4O4kSqaw/IKsmi/T4B0HfI5RuEqPiBE.2', '2025-06-28 00:56:43.653566', false, 'student', 'Sna/25/002', 'Primary 4', NULL, NULL, 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', '2017-05-03', 'Female', NULL, NULL, NULL, 'Atiyah Abdlateef');
INSERT INTO public.users VALUES (29, 'Alani', 'abdulmuqsit@gmail.com', '$2b$10$B8fRmCxDfFOf.5dlDCA8lu5KfZe.d.qrqCky48AiFe0ZES8b/1IBG', '2025-06-28 01:05:21.029293', false, 'student', 'Sna/25/003', 'JSS 1', NULL, NULL, 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', '2025-06-25', 'Male', NULL, NULL, NULL, 'Abdulmuqsit Abdlateef');
INSERT INTO public.users VALUES (30, 'Sumayah ', 'sumayahabdulateef@gmail.com', '$2b$10$8IyalW0LnyVweGKNHzOETOan4mU3PxXoQ5afnCvz.6AKhGjJsoGNu', '2025-06-28 01:09:19.44472', false, 'teacher', NULL, NULL, NULL, NULL, 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', NULL, NULL, NULL, NULL, NULL, 'Sumayah Abdlateef ');
INSERT INTO public.users VALUES (24, 'Abdullah', 'ishola2023m@gmail.com', '$2a$12$h.RUBmgfYfZt26GcKdznLOyvjaTKeFn1TZn.q88PTmwnHKQoObeJO', '2025-06-23 21:08:49.757274', true, 'admin', NULL, NULL, 'Abdullah', 'Abdlateef', NULL, NULL, 'male', NULL, NULL, '$2a$12$h.RUBmgfYfZt26GcKdznLOyvjaTKeFn1TZn.q88PTmwnHKQoObeJO', NULL);
INSERT INTO public.users VALUES (31, 'Ab', 'a@hmail.com', '$2b$10$O3.N0ezOmxw3B8C8CjfhYeARuWwYFJ2ECjdIRLu2jppuwfRO/a84W', '2025-06-28 02:53:37.031426', false, 'student', 'Sna/12/102', 'Primary 3', NULL, NULL, 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', '2025-06-09', NULL, NULL, NULL, NULL, 'Abdlateef Abdullah');
INSERT INTO public.users VALUES (1, 'Abu Sumayah', 'sealednec@gmail.com', '$2a$12$JJV.7X.ZgUZIYFqPfhoZl.Ih2swTcjfB7MpS7wdZ.4Cwoyh3RtONC', '2025-06-01 22:42:59.865333', true, 'admin', NULL, NULL, 'Abu', 'Sumayah', NULL, NULL, 'Male', '2025-06-22 04:45:50.331474', NULL, '$2a$12$JJV.7X.ZgUZIYFqPfhoZl.Ih2swTcjfB7MpS7wdZ.4Cwoyh3RtONC', NULL);


--
-- TOC entry 3538 (class 0 OID 0)
-- Dependencies: 216
-- Name: classes_class_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.classes_class_id_seq', 1, false);


--
-- TOC entry 3539 (class 0 OID 0)
-- Dependencies: 235
-- Name: classes_class_id_seq1; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.classes_class_id_seq1', 1, false);


--
-- TOC entry 3540 (class 0 OID 0)
-- Dependencies: 218
-- Name: exam_results_result_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exam_results_result_id_seq', 29, true);


--
-- TOC entry 3541 (class 0 OID 0)
-- Dependencies: 233
-- Name: exam_sections_section_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exam_sections_section_id_seq', 8, true);


--
-- TOC entry 3542 (class 0 OID 0)
-- Dependencies: 220
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exam_sessions_session_id_seq', 52, true);


--
-- TOC entry 3543 (class 0 OID 0)
-- Dependencies: 222
-- Name: exams_exam_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exams_exam_id_seq', 23, true);


--
-- TOC entry 3544 (class 0 OID 0)
-- Dependencies: 224
-- Name: questions_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.questions_question_id_seq', 128, true);


--
-- TOC entry 3545 (class 0 OID 0)
-- Dependencies: 226
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.report_card_meta_report_id_seq', 1, true);


--
-- TOC entry 3546 (class 0 OID 0)
-- Dependencies: 231
-- Name: results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.results_id_seq', 1, false);


--
-- TOC entry 3547 (class 0 OID 0)
-- Dependencies: 228
-- Name: subjects_subject_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.subjects_subject_id_seq', 70, true);


--
-- TOC entry 3548 (class 0 OID 0)
-- Dependencies: 230
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.users_id_seq', 31, true);


--
-- TOC entry 3332 (class 2606 OID 16681)
-- Name: classes classes_class_code_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_class_code_key UNIQUE (class_code);


--
-- TOC entry 3334 (class 2606 OID 16679)
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- TOC entry 3290 (class 2606 OID 16504)
-- Name: class_levels classes_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT classes_pkey PRIMARY KEY (level_id);


--
-- TOC entry 3336 (class 2606 OID 16677)
-- Name: classes classes_pkey1; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey1 PRIMARY KEY (class_id);


--
-- TOC entry 3296 (class 2606 OID 16506)
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (result_id);


--
-- TOC entry 3328 (class 2606 OID 16636)
-- Name: exam_sections exam_sections_exam_id_section_order_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_exam_id_section_order_key UNIQUE (exam_id, section_order);


--
-- TOC entry 3330 (class 2606 OID 16634)
-- Name: exam_sections exam_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_pkey PRIMARY KEY (section_id);


--
-- TOC entry 3300 (class 2606 OID 16508)
-- Name: exam_sessions exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (session_id);


--
-- TOC entry 3304 (class 2606 OID 16510)
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (exam_id);


--
-- TOC entry 3306 (class 2606 OID 16512)
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (question_id);


--
-- TOC entry 3308 (class 2606 OID 16514)
-- Name: report_card_meta report_card_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_pkey PRIMARY KEY (report_id);


--
-- TOC entry 3310 (class 2606 OID 16516)
-- Name: report_card_meta report_card_meta_student_id_term_session_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_term_session_key UNIQUE (student_id, term, session);


--
-- TOC entry 3326 (class 2606 OID 16609)
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (id);


--
-- TOC entry 3312 (class 2606 OID 16518)
-- Name: subjects subjects_name_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_name_key UNIQUE (name);


--
-- TOC entry 3314 (class 2606 OID 16520)
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (subject_id);


--
-- TOC entry 3316 (class 2606 OID 16522)
-- Name: subjects subjects_subject_code_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_subject_code_key UNIQUE (subject_code);


--
-- TOC entry 3292 (class 2606 OID 16652)
-- Name: class_levels unique_level_code; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT unique_level_code UNIQUE (level_code);


--
-- TOC entry 3294 (class 2606 OID 16650)
-- Name: class_levels unique_level_name; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT unique_level_name UNIQUE (level_name);


--
-- TOC entry 3298 (class 2606 OID 16524)
-- Name: exam_results unique_student_exam; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT unique_student_exam UNIQUE (student_id, exam_id);


--
-- TOC entry 3302 (class 2606 OID 16526)
-- Name: exam_sessions unique_user_exam_session; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT unique_user_exam_session UNIQUE (user_id, exam_id);


--
-- TOC entry 3318 (class 2606 OID 16528)
-- Name: users users_admission_number_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_admission_number_key UNIQUE (admission_number);


--
-- TOC entry 3320 (class 2606 OID 16530)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3322 (class 2606 OID 16532)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3324 (class 2606 OID 16534)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3356 (class 2620 OID 16535)
-- Name: exams set_exam_timestamp; Type: TRIGGER; Schema: public; Owner: sna_db_user
--

CREATE TRIGGER set_exam_timestamp BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- TOC entry 3337 (class 2606 OID 16537)
-- Name: class_levels classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- TOC entry 3338 (class 2606 OID 16542)
-- Name: exam_results exam_results_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3339 (class 2606 OID 16621)
-- Name: exam_results exam_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3340 (class 2606 OID 16552)
-- Name: exam_results exam_results_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3355 (class 2606 OID 16637)
-- Name: exam_sections exam_sections_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3341 (class 2606 OID 16557)
-- Name: exam_sessions exam_sessions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3342 (class 2606 OID 16562)
-- Name: exam_sessions exam_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3343 (class 2606 OID 16567)
-- Name: exam_sessions exam_sessions_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3344 (class 2606 OID 16658)
-- Name: exams exams_class_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_class_level_id_fkey FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE RESTRICT;


--
-- TOC entry 3345 (class 2606 OID 16577)
-- Name: exams exams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3346 (class 2606 OID 16582)
-- Name: exams exams_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id);


--
-- TOC entry 3352 (class 2606 OID 16615)
-- Name: users fk_class; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_class FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE SET NULL;


--
-- TOC entry 3351 (class 2606 OID 16663)
-- Name: subjects fk_class_level; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT fk_class_level FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE RESTRICT;


--
-- TOC entry 3347 (class 2606 OID 16642)
-- Name: questions fk_section; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT fk_section FOREIGN KEY (section_id) REFERENCES public.exam_sections(section_id) ON DELETE CASCADE;


--
-- TOC entry 3348 (class 2606 OID 16587)
-- Name: questions questions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3349 (class 2606 OID 16592)
-- Name: questions questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3350 (class 2606 OID 16597)
-- Name: report_card_meta report_card_meta_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3354 (class 2606 OID 16610)
-- Name: results results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3353 (class 2606 OID 16653)
-- Name: users users_class_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_class_level_id_fkey FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE SET NULL;


--
-- TOC entry 2090 (class 826 OID 16391)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO sna_db_user;


--
-- TOC entry 2092 (class 826 OID 16393)
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO sna_db_user;


--
-- TOC entry 2091 (class 826 OID 16392)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO sna_db_user;


--
-- TOC entry 2089 (class 826 OID 16390)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO sna_db_user;


-- Completed on 2025-06-29 10:51:38

--
-- PostgreSQL database dump complete
--

