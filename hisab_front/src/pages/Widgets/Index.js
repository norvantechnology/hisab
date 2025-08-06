import React from 'react';
import { Container } from 'reactstrap';

// import Components
import BreadCrumb from '../../Components/Common/BreadCrumb';

import TileBoxs from './TileBoxs';
import OtherWidgets from './OtherWidgets';
import UpcomingActivity from './UpcomingActivities';
import ChartMapWidgets from './Chart&MapWidgets';
import EcommerceWidgets from './EcommerceWidgets';

const Widgets = () => {
    document.title = "Widgets | Vyavhar - Financial Management Platform";

    return (
        <React.Fragment>
            <div className="page-content">

                <Container fluid>
                    <BreadCrumb title="Widgets" pageTitle="Vyavhar" />
                    {/* Tile Boxs Widgets */}
                    <TileBoxs />

                    {/* Other Widgets */}
                    <OtherWidgets />

                    {/* Upcoming Activity */}
                    <UpcomingActivity />

                    {/* Chart & Map Widgets */}
                    <ChartMapWidgets />

                    {/* EcommerceWidgets  */}
                    <EcommerceWidgets />

                </Container>
            </div>
        </React.Fragment>
    );
};

export default Widgets;
