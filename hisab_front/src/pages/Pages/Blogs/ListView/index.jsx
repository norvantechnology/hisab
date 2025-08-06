import BreadCrumb from '../../../../Components/Common/BreadCrumb'
import React from 'react'
import { Container, Row } from 'reactstrap'
import Sidepanel from './Sidepanel'
import MainList from './MainList'

const BlogListView = () => {

    document.title="List View | vyavhar - React Admin & Dashboard Template";

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="List View" pageTitle="Blogs" />
                    <Row>

                        <Sidepanel />

                        <MainList />

                    </Row>
                </Container>
            </div>
        </React.Fragment>
    )
}

export default BlogListView